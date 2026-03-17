"""
Privacy & Data Subject Rights — GDPR Art. 15, 17, 20
Endpoints for data access, export (portability), and account deletion (erasure).
"""
import json
import structlog
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import get_current_user, log_audit, get_client_ip
from app.models.user import User
from app.models.audit import AuditLog, ConsentRecord
from app.models.ai import AIConversation, AIMessage

router = APIRouter(prefix="/privacy", tags=["privacy"])
settings = get_settings()
logger = structlog.get_logger(__name__)


@router.get("/my-data")
async def get_my_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GDPR Art. 15 — Right of access.
    Returns all personal data held about the user.
    """
    # Consent records
    consent_result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == current_user.id)
        .order_by(ConsentRecord.timestamp.desc())
    )
    consents = consent_result.scalars().all()

    # AI conversations (if any)
    ai_result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(AIConversation.created_at.desc())
    )
    conversations = ai_result.scalars().all()

    # Audit log entries about this user
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
    )
    audit_entries = audit_result.scalars().all()

    await log_audit(
        db, action="data_access_request", resource_type="privacy",
        user_id=current_user.id, user_email=current_user.email,
        factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 15 — right of access",
        data_categories="identity,contact,consent,activity",
    )
    await db.commit()

    return {
        "personal_data": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
            "language": current_user.language,
            "is_active": current_user.is_active,
            "factory_id": current_user.factory_id,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_login_at": current_user.last_login_at.isoformat() if current_user.last_login_at else None,
        },
        "consent_records": [
            {
                "type": c.consent_type,
                "action": c.action,
                "version": c.version,
                "timestamp": c.timestamp.isoformat(),
            }
            for c in consents
        ],
        "ai_conversations_count": len(conversations),
        "audit_log_count": len(audit_entries),
        "data_retention_policy": {
            "ai_conversations_days": settings.retention_ai_conversations_days,
            "production_data_days": settings.retention_production_data_days,
            "audit_log_days": settings.retention_audit_log_days,
        },
        "gdpr_info": {
            "privacy_policy_accepted_at": (
                current_user.privacy_policy_accepted_at.isoformat()
                if current_user.privacy_policy_accepted_at else None
            ),
            "terms_accepted_at": (
                current_user.terms_accepted_at.isoformat()
                if current_user.terms_accepted_at else None
            ),
            "ai_consent": current_user.ai_consent,
            "marketing_consent": current_user.marketing_consent,
            "consent_version": current_user.consent_version,
        },
    }


@router.get("/export")
async def export_my_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GDPR Art. 20 — Right to data portability.
    Returns all user data in machine-readable JSON format.
    """
    # Consent records
    consent_result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.user_id == current_user.id)
    )
    consents = consent_result.scalars().all()

    # AI conversations with messages
    conv_result = await db.execute(
        select(AIConversation).where(AIConversation.user_id == current_user.id)
    )
    conversations = conv_result.scalars().all()

    conversations_data = []
    for conv in conversations:
        msg_result = await db.execute(
            select(AIMessage)
            .where(AIMessage.conversation_id == conv.id)
            .order_by(AIMessage.created_at)
        )
        messages = msg_result.scalars().all()
        conversations_data.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ],
        })

    await log_audit(
        db, action="data_export_request", resource_type="privacy",
        user_id=current_user.id, user_email=current_user.email,
        factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 20 — right to data portability",
        data_categories="identity,contact,consent,activity,ai_conversations",
    )
    await db.commit()

    return {
        "export_format": "JSON",
        "export_date": datetime.now(timezone.utc).isoformat(),
        "data_controller": "Centro Studi Grassi doo",
        "legal_basis": "GDPR Art. 20 — Right to data portability",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
            "language": current_user.language,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "consent_history": [
            {
                "type": c.consent_type,
                "action": c.action,
                "version": c.version,
                "timestamp": c.timestamp.isoformat(),
            }
            for c in consents
        ],
        "ai_conversations": conversations_data,
    }


class DeleteAccountRequest(BaseModel):
    password: str


@router.post("/delete-account")
async def request_account_deletion(
    request: Request,
    body: DeleteAccountRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GDPR Art. 17 — Right to erasure.
    Initiates soft deletion with a grace period before permanent data removal.
    Requires password re-confirmation for security.
    """
    from app.core.security import verify_password
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    if current_user.is_deleted:
        raise HTTPException(status_code=400, detail="Account already marked for deletion")

    now = datetime.now(timezone.utc)
    current_user.is_deleted = True
    current_user.deleted_at = now
    current_user.deletion_requested_at = now
    current_user.is_active = False

    await log_audit(
        db, action="account_deletion_requested", resource_type="user",
        resource_id=str(current_user.id), user_id=current_user.id,
        user_email=current_user.email, factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        detail=f"Grace period: {settings.retention_deleted_account_grace_days} days",
        legal_basis="GDPR Art. 17 — right to erasure",
        data_categories="identity,contact,consent,activity",
    )
    await db.commit()

    return {
        "detail": "Account marked for deletion",
        "grace_period_days": settings.retention_deleted_account_grace_days,
        "permanent_deletion_after": (
            (now + timedelta(days=settings.retention_deleted_account_grace_days)).isoformat()
        ),
        "note": (
            f"Your account will be permanently deleted after "
            f"{settings.retention_deleted_account_grace_days} days. "
            f"Contact support to reverse this within the grace period."
        ),
    }
