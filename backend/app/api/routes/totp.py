"""
Two-Factor Authentication (TOTP) routes — GDPR Art. 32 security of processing.
Implements TOTP setup, verification, and disable flows.
"""
import io
import base64
import structlog
from datetime import datetime, timezone

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import (
    get_current_user, log_audit, get_client_ip, verify_password,
    decode_token, create_access_token, create_refresh_token,
    check_rate_limit,
)
from app.models.user import User

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth/totp", tags=["2fa"])


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_code: str  # base64-encoded PNG
    uri: str


class TOTPVerifyRequest(BaseModel):
    code: str


class TOTPDisableRequest(BaseModel):
    password: str
    code: str


class TOTPLoginValidateRequest(BaseModel):
    temp_token: str
    code: str


@router.post("/setup", response_model=TOTPSetupResponse)
async def setup_totp(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a TOTP secret and QR code for 2FA setup."""
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first to reconfigure.")

    secret = pyotp.random_base32()
    current_user.totp_secret = secret

    # Generate provisioning URI
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(
        name=current_user.email,
        issuer_name="LeanPilot",
    )

    # Generate QR code as base64 PNG
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    await log_audit(
        db, action="totp_setup_initiated", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 32 — security of processing",
    )
    await db.commit()

    return TOTPSetupResponse(secret=secret, qr_code=qr_b64, uri=uri)


@router.post("/verify")
async def verify_totp(
    request: Request,
    data: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a TOTP code to activate 2FA. Must be called after /setup."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /setup first to generate a TOTP secret")
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    current_user.totp_enabled = True

    await log_audit(
        db, action="totp_enabled", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 32 — security of processing",
    )
    await db.commit()

    return {"detail": "2FA enabled successfully"}


@router.post("/disable")
async def disable_totp(
    request: Request,
    data: TOTPDisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable 2FA. Requires current password + valid TOTP code for security."""
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid password")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    current_user.totp_enabled = False
    current_user.totp_secret = None

    await log_audit(
        db, action="totp_disabled", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 32 — security of processing",
    )
    await db.commit()

    return {"detail": "2FA disabled successfully"}


@router.post("/validate")
async def validate_totp_code(
    request: Request,
    data: TOTPLoginValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete 2FA login: verify the temp_token (type=2fa_pending) + TOTP code,
    then issue the real access + refresh tokens.
    """
    from sqlalchemy import select as sa_select

    # Rate limit TOTP validation to prevent brute-force (6-digit = 1M possibilities)
    check_rate_limit(
        key=f"totp_validate:{get_client_ip(request)}",
        max_requests=10,
        window_seconds=60,
    )

    # Decode the 2FA pending token (will raise 401 if expired or invalid)
    payload = decode_token(data.temp_token, expected_type="2fa_pending")
    user_id = payload["sub"]

    result = await db.execute(sa_select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(status_code=401, detail="Invalid token or user")

    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid TOTP code")

    # TOTP verified — issue real tokens
    token_data = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "fid": user.factory_id,
    }
    access = create_access_token(data=token_data)
    refresh = create_refresh_token(data={"sub": str(user.id)})

    client_ip = get_client_ip(request)
    await log_audit(
        db, action="login_success_2fa", resource_type="auth",
        user_id=user.id, user_email=user.email,
        factory_id=user.factory_id, ip_address=client_ip,
        detail="Login completed with TOTP verification",
        legal_basis="GDPR Art. 6(1)(b) — contract performance",
    )
    await db.commit()

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
    }
