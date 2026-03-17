"""
Authentication routes — GDPR-compliant login, signup, consent management.
Implements: rate limiting, account lockout, token revocation, audit logging.
"""
import secrets
import structlog
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import (
    verify_password, get_password_hash, create_access_token, create_refresh_token,
    create_2fa_pending_token, decode_token, get_current_user, get_current_active_admin,
    require_factory, check_rate_limit, revoke_token, log_audit, get_client_ip,
    validate_password_strength,
)
from app.models.user import User, UserRole
from app.models.factory import Factory
from app.models.audit import ConsentRecord
from app.schemas.auth import (
    LoginRequest, TokenResponse, UserCreate, UserResponse,
    LandingPageSignup, SignupResponse, PasswordChangeRequest,
    ConsentUpdateRequest, ConsentAcceptRequest,
)
from app.services.email_service import EmailService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_VALID_ROLES = {r.value for r in UserRole}


# ---------------------------------------------------------------------------
# Login — rate limited, account lockout, audit logged
# ---------------------------------------------------------------------------

@router.post("/login")
async def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_client_ip(request)

    # Rate limit by IP
    check_rate_limit(
        key=f"login:{client_ip}",
        max_requests=settings.rate_limit_login_per_minute,
        window_seconds=60,
    )

    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form.password, user.hashed_password):
        # Track failed attempts for account lockout
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= settings.account_lockout_attempts:
                from datetime import timedelta
                user.locked_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.account_lockout_minutes
                )
                logger.warning(f"Account locked: {user.email} after {user.failed_login_attempts} failed attempts")
            await db.flush()

        await log_audit(
            db, action="login_failed", resource_type="auth",
            user_email=form.username, ip_address=client_ip,
            detail="Invalid credentials",
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Check account lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked. Try again in {remaining} minutes.",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    if user.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been deleted")

    # Successful login — reset lockout counters, track session
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = client_ip
    user.last_user_agent = request.headers.get("User-Agent", "unknown")[:512]

    # H7: If TOTP is enabled, issue a short-lived 2FA pending token instead
    if user.totp_enabled:
        temp_token = create_2fa_pending_token(data={"sub": str(user.id)})
        await log_audit(
            db, action="login_2fa_pending", resource_type="auth",
            user_id=user.id, user_email=user.email,
            factory_id=user.factory_id, ip_address=client_ip,
            detail="TOTP verification required",
            legal_basis="GDPR Art. 6(1)(b) — contract performance",
        )
        await db.commit()
        return {"requires_2fa": True, "temp_token": temp_token}

    # Include role and factory_id in token for RBAC
    token_data = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "fid": user.factory_id,
    }
    access = create_access_token(data=token_data)
    refresh = create_refresh_token(data={"sub": str(user.id)})

    await log_audit(
        db, action="login_success", resource_type="auth",
        user_id=user.id, user_email=user.email,
        factory_id=user.factory_id, ip_address=client_ip,
        legal_basis="GDPR Art. 6(1)(b) — contract performance",
    )
    await db.commit()

    return TokenResponse(access_token=access, refresh_token=refresh)


# ---------------------------------------------------------------------------
# Logout — token revocation
# ---------------------------------------------------------------------------

@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke the current access token (GDPR Art. 25 — data protection by design)."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        revoke_token(auth_header[7:])

    await log_audit(
        db, action="logout", resource_type="auth",
        user_id=current_user.id, user_email=current_user.email,
        factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
    )
    await db.commit()
    return {"detail": "Logged out successfully"}


# ---------------------------------------------------------------------------
# Refresh — rotate tokens, revoke old refresh token
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    """Exchange a valid refresh token for a new access + refresh pair. Old refresh is revoked."""
    payload = decode_token(refresh_token, expected_type="refresh")
    user_id = payload["sub"]

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # Revoke old refresh token (rotation)
    revoke_token(refresh_token)

    token_data = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "fid": user.factory_id,
    }
    access = create_access_token(data=token_data)
    new_refresh = create_refresh_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access, refresh_token=new_refresh)


# ---------------------------------------------------------------------------
# Register (admin creates team members within their factory)
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserResponse)
async def register(
    request: Request,
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Register a new user within the admin's factory. Requires admin auth."""
    # H1: Validate password strength (defense-in-depth, supplements schema validation)
    pwd_errors = validate_password_strength(data.password)
    if pwd_errors:
        raise HTTPException(status_code=400, detail=pwd_errors)

    if data.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(_VALID_ROLES)}")
    if data.role == UserRole.ADMIN.value:
        raise HTTPException(status_code=400, detail="Cannot create additional admin users via this endpoint")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        language=data.language,
        factory_id=admin.factory_id,
    )
    db.add(user)
    await db.flush()

    await log_audit(
        db, action="user_created", resource_type="user",
        resource_id=str(user.id), user_id=admin.id, user_email=admin.email,
        factory_id=admin.factory_id, ip_address=get_client_ip(request),
        detail=f"Created user {data.email} with role {data.role}",
        legal_basis="GDPR Art. 6(1)(b) — contract performance",
        data_categories="identity,contact",
    )
    await db.commit()
    return user


# ---------------------------------------------------------------------------
# Signup — public landing page, GDPR consent collection
# ---------------------------------------------------------------------------

@router.post("/signup", response_model=SignupResponse)
async def landing_page_signup(
    request: Request,
    data: LandingPageSignup,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Public landing page registration with GDPR-compliant consent collection.
    GDPR Art. 6(1)(b) — processing necessary for contract performance.
    GDPR Art. 7 — consent must be freely given, specific, informed, unambiguous.
    """
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Enforce mandatory consents
    if not data.gdpr_consent:
        raise HTTPException(status_code=400, detail="GDPR consent is required")
    if not data.privacy_policy_accepted:
        raise HTTPException(status_code=400, detail="Privacy policy acceptance is required")
    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms acceptance is required")

    emp_count = None
    if data.employee_count:
        try:
            parts = data.employee_count.replace("+", "").split("-")
            emp_count = int(parts[-1])
        except (ValueError, IndexError):
            pass

    factory = Factory(
        name=data.factory_name or f"{data.email.split('@')[0]}'s Factory",
        employee_count=emp_count,
    )
    db.add(factory)
    await db.flush()

    temp_password = secrets.token_urlsafe(12)
    name_guess = data.email.split("@")[0].replace(".", " ").replace("_", " ").title()
    now = datetime.now(timezone.utc)

    user = User(
        email=data.email,
        hashed_password=get_password_hash(temp_password),
        full_name=name_guess,
        role=UserRole.ADMIN,
        is_active=True,
        factory_id=factory.id,
        language=data.language,
        # GDPR consent timestamps
        privacy_policy_accepted_at=now,
        terms_accepted_at=now,
        consent_version="1.0",
        ai_consent=data.ai_consent,
        marketing_consent=data.marketing_consent,
    )
    db.add(user)
    await db.flush()

    # Record each consent as immutable audit trail (GDPR Art. 7)
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "unknown")

    consent_types = [
        ("gdpr_general", "granted"),
        ("privacy_policy", "granted"),
        ("terms_of_service", "granted"),
    ]
    if data.ai_consent:
        consent_types.append(("ai_processing", "granted"))
    if data.marketing_consent:
        consent_types.append(("marketing", "granted"))

    for consent_type, action in consent_types:
        db.add(ConsentRecord(
            user_id=user.id,
            consent_type=consent_type,
            action=action,
            version="1.0",
            ip_address=client_ip,
            user_agent=user_agent,
        ))

    await log_audit(
        db, action="signup", resource_type="user",
        resource_id=str(user.id), user_id=user.id, user_email=data.email,
        factory_id=factory.id, ip_address=client_ip,
        detail=f"Landing page signup, factory '{factory.name}'",
        legal_basis="GDPR Art. 6(1)(b) — contract performance",
        data_categories="identity,contact,consent",
    )
    await db.commit()

    background_tasks.add_task(
        EmailService.send_welcome_email,
        to_email=data.email,
        full_name=name_guess,
        temp_password=temp_password,
        factory_name=factory.name,
        lang=data.language,
    )

    return SignupResponse(
        success=True,
        message="Account created! Check your email for login credentials.",
    )


# ---------------------------------------------------------------------------
# Me — current user profile
# ---------------------------------------------------------------------------

CURRENT_CONSENT_VERSION = "1.0"


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    # Compute needs_consent: True if user hasn't accepted current policy version
    needs = (
        current_user.privacy_policy_accepted_at is None
        or current_user.terms_accepted_at is None
        or current_user.consent_version != CURRENT_CONSENT_VERSION
    )
    # Attach computed field (won't persist, just for response serialization)
    current_user._needs_consent = needs
    return current_user


@router.post("/accept-consent", response_model=UserResponse)
async def accept_consent(
    request: Request,
    data: ConsentAcceptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    First-login consent gate — GDPR Art. 7.
    Records user acceptance of privacy policy and terms.
    """
    if not data.privacy_policy_accepted:
        raise HTTPException(status_code=400, detail="Privacy policy acceptance is required")
    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Terms acceptance is required")

    now = datetime.now(timezone.utc)
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "unknown")

    current_user.privacy_policy_accepted_at = now
    current_user.terms_accepted_at = now
    current_user.consent_version = CURRENT_CONSENT_VERSION
    current_user.ai_consent = data.ai_consent
    current_user.marketing_consent = data.marketing_consent

    # Record each consent as immutable audit trail
    consent_types = [
        ("privacy_policy", "granted"),
        ("terms_of_service", "granted"),
    ]
    if data.ai_consent:
        consent_types.append(("ai_processing", "granted"))
    if data.marketing_consent:
        consent_types.append(("marketing", "granted"))

    for consent_type, action in consent_types:
        db.add(ConsentRecord(
            user_id=current_user.id,
            consent_type=consent_type,
            action=action,
            version=CURRENT_CONSENT_VERSION,
            ip_address=client_ip,
            user_agent=user_agent,
        ))

    await log_audit(
        db, action="consent_accepted", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=client_ip,
        detail=f"Accepted consent v{CURRENT_CONSENT_VERSION}",
        legal_basis="GDPR Art. 7 — consent",
        data_categories="consent",
    )
    await db.commit()

    current_user._needs_consent = False
    return current_user


# ---------------------------------------------------------------------------
# Profile update — user self-service
# ---------------------------------------------------------------------------

@router.patch("/me", response_model=UserResponse)
async def update_profile(
    request: Request,
    full_name: str | None = Body(None, embed=False),
    language: str | None = Body(None, embed=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update own profile (name, language). GDPR Art. 16 — right to rectification."""
    import json
    body = await request.body()
    data = json.loads(body) if body else {}

    changes = []
    if "full_name" in data and data["full_name"]:
        current_user.full_name = data["full_name"]
        changes.append(f"full_name={data['full_name']}")
    if "language" in data and data["language"] in ("en", "it", "de", "es", "fr", "pl", "sr"):
        current_user.language = data["language"]
        changes.append(f"language={data['language']}")

    if changes:
        await log_audit(
            db, action="profile_updated", resource_type="user",
            resource_id=str(current_user.id), user_id=current_user.id,
            user_email=current_user.email, factory_id=current_user.factory_id,
            ip_address=get_client_ip(request),
            detail=", ".join(changes),
            legal_basis="GDPR Art. 16 — right to rectification",
        )
        await db.commit()

    return current_user


# ---------------------------------------------------------------------------
# Password change — GDPR Art. 32 (security of processing)
# ---------------------------------------------------------------------------

@router.post("/change-password")
async def change_password(
    request: Request,
    data: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change password. Requires current password verification."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # H1: Validate password strength (defense-in-depth, supplements schema validation)
    pwd_errors = validate_password_strength(data.new_password)
    if pwd_errors:
        raise HTTPException(status_code=400, detail=pwd_errors)

    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.password_changed_at = datetime.now(timezone.utc)

    await log_audit(
        db, action="password_changed", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 32 — security of processing",
    )
    await db.commit()
    return {"detail": "Password changed successfully"}


# ---------------------------------------------------------------------------
# Consent management — GDPR Art. 7(3) right to withdraw
# ---------------------------------------------------------------------------

@router.patch("/consent")
async def update_consent(
    request: Request,
    data: ConsentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update granular consent preferences. GDPR Art. 7(3) — right to withdraw."""
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "unknown")
    changes = []

    if data.ai_consent is not None and data.ai_consent != current_user.ai_consent:
        current_user.ai_consent = data.ai_consent
        action = "granted" if data.ai_consent else "withdrawn"
        db.add(ConsentRecord(
            user_id=current_user.id,
            consent_type="ai_processing",
            action=action,
            version="1.0",
            ip_address=client_ip,
            user_agent=user_agent,
        ))
        changes.append(f"ai_consent={action}")

    if data.marketing_consent is not None and data.marketing_consent != current_user.marketing_consent:
        current_user.marketing_consent = data.marketing_consent
        action = "granted" if data.marketing_consent else "withdrawn"
        db.add(ConsentRecord(
            user_id=current_user.id,
            consent_type="marketing",
            action=action,
            version="1.0",
            ip_address=client_ip,
            user_agent=user_agent,
        ))
        changes.append(f"marketing_consent={action}")

    if changes:
        await log_audit(
            db, action="consent_updated", resource_type="user",
            resource_id=str(current_user.id), user_id=current_user.id,
            user_email=current_user.email, factory_id=current_user.factory_id,
            ip_address=client_ip,
            detail=", ".join(changes),
            legal_basis="GDPR Art. 7(3) — right to withdraw consent",
        )
        await db.commit()

    return {"detail": "Consent preferences updated", "changes": changes}
