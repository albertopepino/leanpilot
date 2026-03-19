"""
Security module — Authentication, authorization, rate limiting, audit logging.
Implements GDPR-compliant security controls.
"""
import re
import time
import structlog
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import get_db

logger = structlog.get_logger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

settings = get_settings()

# ---------------------------------------------------------------------------
# Redis-backed stores for token blacklist & rate limiting
# ---------------------------------------------------------------------------
_redis_client = None


def _get_redis():
    """Lazy-init Redis connection. Falls back to in-memory if unavailable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis as redis_lib
        _redis_client = redis_lib.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
        logger.info("Redis connected for token blacklist & rate limiting")
    except Exception as e:
        logger.warning(f"Redis unavailable ({e}), falling back to in-memory stores")
        _redis_client = None
    return _redis_client


# ---------------------------------------------------------------------------
# Password hashing & validation
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def validate_password_strength(password: str) -> list[str]:
    """Validate password meets security requirements. Returns list of violations."""
    errors = []
    if len(password) < settings.password_min_length:
        errors.append(f"Password must be at least {settings.password_min_length} characters")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]", password):
        errors.append("Password must contain at least one special character")
    return errors


# ---------------------------------------------------------------------------
# Rate limiting (Redis-backed with in-memory fallback)
# ---------------------------------------------------------------------------
_fallback_attempts: dict[str, list[float]] = {}
_FALLBACK_MAX_KEYS = 10_000
_FALLBACK_TTL_SECONDS = 3600  # 1 hour


def _prune_fallback_attempts() -> None:
    """Evict stale entries from the in-memory rate limiter to prevent OOM."""
    if len(_fallback_attempts) <= _FALLBACK_MAX_KEYS:
        return
    now = time.time()
    cutoff = now - _FALLBACK_TTL_SECONDS
    stale_keys = [k for k, v in _fallback_attempts.items() if not v or v[-1] < cutoff]
    for k in stale_keys:
        del _fallback_attempts[k]
    # If still over limit, remove oldest entries
    if len(_fallback_attempts) > _FALLBACK_MAX_KEYS:
        sorted_keys = sorted(_fallback_attempts, key=lambda k: _fallback_attempts[k][-1] if _fallback_attempts[k] else 0)
        for k in sorted_keys[:len(_fallback_attempts) - _FALLBACK_MAX_KEYS]:
            del _fallback_attempts[k]


def check_rate_limit(key: str, max_requests: int, window_seconds: int = 60):
    """Sliding-window rate limiter backed by Redis. Falls back to in-memory."""
    r = _get_redis()
    if r:
        try:
            redis_key = f"rl:{key}"
            now = time.time()
            pipe = r.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, window_seconds)
            results = pipe.execute()
            count = results[1]
            if count >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Try again in {window_seconds} seconds.",
                )
            return
        except HTTPException:
            raise
        except Exception:
            pass  # Fall through to in-memory

    _prune_fallback_attempts()
    now = time.time()
    cutoff = now - window_seconds
    attempts = _fallback_attempts.get(key, [])
    attempts = [t for t in attempts if t > cutoff]
    if len(attempts) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests. Try again in {window_seconds} seconds.",
        )
    attempts.append(now)
    _fallback_attempts[key] = attempts


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    import uuid
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({
        "exp": expire,
        "type": "access",
        "jti": str(uuid.uuid4()),  # Unique token ID for revocation
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_2fa_pending_token(data: dict) -> str:
    """Create a short-lived token (5 min) for 2FA pending state. Only valid at /auth/totp/validate."""
    import uuid
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    to_encode.update({
        "exp": expire,
        "type": "2fa_pending",
        "jti": str(uuid.uuid4()),
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: dict) -> str:
    import uuid
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "iat": datetime.now(timezone.utc),
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


_fallback_blacklist: dict[str, float] = {}  # jti -> expiry timestamp
_BLACKLIST_MAX_ENTRIES = 10_000


def _prune_fallback_blacklist() -> None:
    """Evict expired entries from the in-memory token blacklist."""
    if len(_fallback_blacklist) <= _BLACKLIST_MAX_ENTRIES:
        return
    now = time.time()
    expired = [jti for jti, exp in _fallback_blacklist.items() if exp < now]
    for jti in expired:
        del _fallback_blacklist[jti]


def revoke_token(token: str):
    """Add a token's JTI to the blacklist (logout / forced invalidation)."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        jti = payload.get("jti")
        if not jti:
            return
        # Calculate remaining TTL so Redis auto-expires the entry
        exp = payload.get("exp", 0)
        ttl = max(int(exp - time.time()), 60)
        r = _get_redis()
        if r:
            try:
                r.setex(f"bl:{jti}", ttl, "1")
                return
            except Exception:
                pass
        _prune_fallback_blacklist()
        _fallback_blacklist[jti] = exp
    except JWTError:
        pass  # Token already expired or invalid — no-op


def _is_token_revoked(jti: str) -> bool:
    """Check if a JTI is in the blacklist (Redis or fallback)."""
    r = _get_redis()
    if r:
        try:
            return r.exists(f"bl:{jti}") > 0
        except Exception:
            pass
    exp = _fallback_blacklist.get(jti)
    if exp is None:
        return False
    if exp < time.time():
        del _fallback_blacklist[jti]
        return False
    return True


def decode_token(token: str, expected_type: str = "access") -> dict:
    """Decode and validate a JWT token. Raises HTTPException on failure."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != expected_type:
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        # Check token blacklist (revoked tokens)
        jti = payload.get("jti")
        if jti and _is_token_revoked(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError:
        raise credentials_exception


# ---------------------------------------------------------------------------
# User retrieval & authentication dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.user import User

    # 1. Try httpOnly cookie first (browser clients)
    resolved_token = request.cookies.get("access_token")
    # 2. Fall back to Authorization header (API / mobile clients)
    if not resolved_token:
        resolved_token = token
    if not resolved_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(resolved_token, expected_type="access")
    user_id = payload["sub"]

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    if user.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account has been deleted")
    return user


async def get_current_active_admin(
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dependency that requires the current user to be a factory admin."""
    from app.models.user import UserRole
    # Compare case-insensitively to handle UPPERCASE enum values from PostgreSQL
    user_role_str = (user.role.value if hasattr(user.role, "value") else str(user.role)).lower()
    if user_role_str != UserRole.ADMIN.value:
        await log_audit(
            db, action="admin_check_failed", resource_type="auth",
            user_id=user.id, user_email=user.email,
            factory_id=user.factory_id,
            ip_address=get_client_ip(request),
            detail=f"Admin access denied for role {user_role_str}",
        )
        await db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# RBAC — Role-based access control
# ---------------------------------------------------------------------------

# Role hierarchy: ADMIN > PLANT_MANAGER > LINE_SUPERVISOR > OPERATOR > VIEWER
_ROLE_LEVELS = {
    "admin": 50,
    "plant_manager": 40,
    "line_supervisor": 30,
    "operator": 20,
    "viewer": 10,
}


def require_role(minimum_role: str):
    """FastAPI dependency factory — require minimum role level."""
    min_level = _ROLE_LEVELS.get(minimum_role, 0)

    async def _check(
        request: Request,
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        user_role = (user.role.value if hasattr(user.role, "value") else str(user.role)).lower()
        user_level = _ROLE_LEVELS.get(user_role, 0)
        if user_level < min_level:
            await log_audit(
                db, action="role_check_failed", resource_type="auth",
                user_id=user.id, user_email=user.email,
                factory_id=user.factory_id,
                ip_address=get_client_ip(request),
                detail=f"Required {minimum_role} (level {min_level}), user has {user_role} (level {user_level})",
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum_role} role or higher",
            )
        return user
    return _check


# ---------------------------------------------------------------------------
# Group policy enforcement — backend permission checks
# ---------------------------------------------------------------------------

# Permission hierarchy: full > modify > view > hidden
_PERMISSION_LEVELS = {
    "full": 40,
    "modify": 30,
    "view": 20,
    "hidden": 0,
}


def require_permission(tab_id: str, minimum: str = "view"):
    """FastAPI dependency factory — enforce group-based tab/module permissions.

    Checks the user's groups for a policy on *tab_id* and verifies the
    permission level meets or exceeds *minimum*.  Admins always pass.
    If no policy is found for the tab, access is allowed by default
    (open-by-default for tabs without explicit policies).
    """
    min_level = _PERMISSION_LEVELS.get(minimum, 0)

    async def _check(
        request: Request,
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        from app.models.user import UserRole

        # Admins bypass group policy checks
        user_role = user.role.value if hasattr(user.role, "value") else user.role
        if user_role == UserRole.ADMIN.value:
            return user

        # Load user's active group policies for this tab
        from app.models.groups import Group, GroupPolicy, user_groups
        result = await db.execute(
            select(GroupPolicy.permission)
            .join(Group, GroupPolicy.group_id == Group.id)
            .join(user_groups, user_groups.c.group_id == Group.id)
            .where(
                user_groups.c.user_id == user.id,
                Group.factory_id == user.factory_id,
                Group.is_active == True,  # noqa: E712
                GroupPolicy.tab_id == tab_id,
            )
        )
        permissions = [row[0] for row in result.all()]

        if not permissions:
            # No policy defined for this tab — allow by default
            return user

        # Use the highest permission across all groups the user belongs to
        best_level = max(_PERMISSION_LEVELS.get(p, 0) for p in permissions)

        if best_level < min_level:
            await log_audit(
                db, action="permission_denied", resource_type="policy",
                user_id=user.id, user_email=user.email,
                factory_id=user.factory_id,
                ip_address=get_client_ip(request),
                detail=f"Tab '{tab_id}' requires '{minimum}', user has level {best_level}",
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions for {tab_id}",
            )
        return user

    return _check


# ---------------------------------------------------------------------------
# Tenant isolation helpers
# ---------------------------------------------------------------------------

async def apply_rls(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """FastAPI dependency — sets Postgres RLS session variables based on current user.

    Injects SET LOCAL app.current_factory_id and app.is_admin into the
    current transaction so that Row Level Security policies filter rows
    automatically.  Returns the user object so it can replace
    ``get_current_user`` in route signatures that also need RLS.
    """
    from app.db.session import set_rls_context
    from app.models.user import UserRole

    is_admin = (
        (user.role.value if hasattr(user.role, "value") else str(user.role)).lower()
        == UserRole.ADMIN.value
    )
    await set_rls_context(db, factory_id=user.factory_id, is_admin=is_admin)
    return user


def require_factory(user) -> int:
    """Extract and validate factory_id from user. Raises 400 if not assigned."""
    if not user.factory_id:
        raise HTTPException(status_code=400, detail="User not assigned to a factory")
    return user.factory_id


def require_same_factory(user, resource_factory_id: int):
    """Validate that a resource belongs to the user's factory (tenant isolation)."""
    fid = require_factory(user)
    if fid != resource_factory_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


# ---------------------------------------------------------------------------
# Audit logging helper
# ---------------------------------------------------------------------------

async def log_audit(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    user_id: int | None = None,
    user_email: str | None = None,
    factory_id: int | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
    legal_basis: str | None = None,
    data_categories: str | None = None,
    metadata: dict | None = None,
):
    """Write an immutable audit log entry."""
    from app.models.audit import AuditLog
    entry = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        user_id=user_id,
        user_email=_mask_email(user_email) if user_email else None,
        factory_id=factory_id,
        detail=detail,
        ip_address=ip_address,
        legal_basis=legal_basis,
        data_categories=data_categories,
        metadata_=metadata,
    )
    db.add(entry)


def _mask_email(email: str) -> str:
    """Mask email for audit logs: j***n@example.com"""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked = local[0] + "***"
    else:
        masked = local[0] + "***" + local[-1]
    return f"{masked}@{domain}"


def get_client_ip(request: Request) -> str:
    """Extract client IP from X-Real-IP (set by nginx) or X-Forwarded-For.
    Uses X-Real-IP first (most reliable when set by trusted proxy),
    then falls back to rightmost X-Forwarded-For entry (appended by nginx).
    """
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",")]
        return parts[-1] if parts else "unknown"
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# Cookie helpers — httpOnly secure cookie auth (GDPR Art. 32)
# ---------------------------------------------------------------------------

def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly access + refresh cookies on a FastAPI Response."""
    is_secure = not settings.debug  # Allow non-secure in dev (http://localhost)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/v1/auth",  # Only sent to auth endpoints
    )
    # Non-httpOnly flag so the frontend JS can detect "logged in" state
    response.set_cookie(
        key="logged_in",
        value="1",
        httponly=False,
        secure=is_secure,
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/",
    )


def clear_auth_cookies(response) -> None:
    """Delete all auth cookies on logout."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    response.delete_cookie(key="logged_in", path="/")
