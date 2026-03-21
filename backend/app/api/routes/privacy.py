"""
Privacy & Data Subject Rights — GDPR Art. 15, 17, 20
Endpoints for data access, export (portability), account deletion (erasure),
and sub-processor transparency.
"""
import json
import structlog
from datetime import datetime, timedelta, timezone
from typing import List

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import get_current_user, log_audit, get_client_ip
from app.models.user import User
from app.models.audit import AuditLog, ConsentRecord
from app.models.ai import AIConversation, AIMessage
from app.models.production import ProductionRecord, DowntimeEvent, ScrapRecord
from app.models.lean import OEERecord, FiveWhyAnalysis, FiveWhyStep, KaizenItem
from app.models.qc import QCRecord
from app.models.factory import ProductionLine

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
    limit: int = Query(1000, ge=1, le=5000, description="Max records per data category"),
    offset: int = Query(0, ge=0, description="Record offset for pagination"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    GDPR Art. 20 — Right to data portability.
    Returns all user data in machine-readable JSON format.
    Paginated with limit/offset to prevent OOM on large datasets.
    """
    # Consent records
    consent_result = await db.execute(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == current_user.id)
        .offset(offset).limit(limit)
    )
    consents = consent_result.scalars().all()

    # Audit log entries related to this user
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.timestamp.desc())
        .offset(offset).limit(limit)
    )
    audit_entries = audit_result.scalars().all()

    # AI conversations with messages — eager-load messages to avoid N+1
    conv_result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .options(selectinload(AIConversation.messages))
        .offset(offset).limit(limit)
    )
    conversations = conv_result.scalars().unique().all()

    conversations_data = []
    for conv in conversations:
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
                for m in conv.messages
            ],
        })

    # -----------------------------------------------------------------------
    # Factory production data — records created by or belonging to user's factory
    # -----------------------------------------------------------------------
    user_factory_id = current_user.factory_id

    # Get production line IDs for this user's factory
    factory_line_ids: list[int] = []
    if user_factory_id:
        lines_result = await db.execute(
            select(ProductionLine.id).where(ProductionLine.factory_id == user_factory_id)
        )
        factory_line_ids = [row[0] for row in lines_result.all()]

    # OEE Records (linked via production_line_id)
    oee_data: list[dict] = []
    if factory_line_ids:
        oee_result = await db.execute(
            select(OEERecord).where(OEERecord.production_line_id.in_(factory_line_ids))
            .offset(offset).limit(limit)
        )
        oee_data = [
            {
                "id": r.id,
                "production_line_id": r.production_line_id,
                "date": r.date.isoformat() if r.date else None,
                "availability": r.availability,
                "performance": r.performance,
                "quality": r.quality,
                "oee": r.oee,
                "planned_time_min": r.planned_time_min,
                "run_time_min": r.run_time_min,
                "total_pieces": r.total_pieces,
                "good_pieces": r.good_pieces,
                "downtime_min": r.downtime_min,
            }
            for r in oee_result.scalars().all()
        ]

    # Production Records (recorded_by_id == user OR in user's factory lines)
    prod_data: list[dict] = []
    if factory_line_ids:
        prod_result = await db.execute(
            select(ProductionRecord).where(
                ProductionRecord.production_line_id.in_(factory_line_ids)
            ).offset(offset).limit(limit)
        )
        prod_data = [
            {
                "id": r.id,
                "production_line_id": r.production_line_id,
                "date": r.date.isoformat() if r.date else None,
                "planned_production_time_min": r.planned_production_time_min,
                "actual_run_time_min": r.actual_run_time_min,
                "total_pieces": r.total_pieces,
                "good_pieces": r.good_pieces,
                "ideal_cycle_time_sec": r.ideal_cycle_time_sec,
                "recorded_by_id": r.recorded_by_id,
                "notes": r.notes,
            }
            for r in prod_result.scalars().all()
        ]

    # Downtime Events
    downtime_data: list[dict] = []
    if factory_line_ids:
        dt_result = await db.execute(
            select(DowntimeEvent).where(
                DowntimeEvent.production_line_id.in_(factory_line_ids)
            ).offset(offset).limit(limit)
        )
        downtime_data = [
            {
                "id": r.id,
                "production_line_id": r.production_line_id,
                "start_time": r.start_time.isoformat() if r.start_time else None,
                "end_time": r.end_time.isoformat() if r.end_time else None,
                "duration_minutes": r.duration_minutes,
                "category": r.category,
                "reason": r.reason,
                "machine": r.machine,
                "recorded_by_id": r.recorded_by_id,
                "notes": r.notes,
            }
            for r in dt_result.scalars().all()
        ]

    # Scrap Records
    scrap_data: list[dict] = []
    if factory_line_ids:
        scrap_result = await db.execute(
            select(ScrapRecord).where(
                ScrapRecord.production_line_id.in_(factory_line_ids)
            ).offset(offset).limit(limit)
        )
        scrap_data = [
            {
                "id": r.id,
                "production_line_id": r.production_line_id,
                "date": r.date.isoformat() if r.date else None,
                "quantity": r.quantity,
                "defect_type": r.defect_type,
                "defect_description": r.defect_description,
                "cost_estimate": r.cost_estimate,
                "root_cause": r.root_cause,
                "recorded_by_id": r.recorded_by_id,
            }
            for r in scrap_result.scalars().all()
        ]

    # QC Records (factory_id based)
    qc_data: list[dict] = []
    if user_factory_id:
        qc_result = await db.execute(
            select(QCRecord).where(QCRecord.factory_id == user_factory_id)
            .offset(offset).limit(limit)
        )
        qc_data = [
            {
                "id": r.id,
                "factory_id": r.factory_id,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in qc_result.scalars().all()
        ]

    # Kaizen Items (created_by_id == user OR factory_id == user's factory)
    kaizen_data: list[dict] = []
    if user_factory_id:
        kaizen_result = await db.execute(
            select(KaizenItem).where(
                (KaizenItem.created_by_id == current_user.id)
                | (KaizenItem.factory_id == user_factory_id)
            ).offset(offset).limit(limit)
        )
        kaizen_data = [
            {
                "id": r.id,
                "factory_id": r.factory_id,
                "title": r.title,
                "description": r.description,
                "category": r.category,
                "priority": r.priority,
                "status": r.status,
                "created_by_id": r.created_by_id,
                "expected_impact": r.expected_impact,
                "expected_savings_eur": r.expected_savings_eur,
                "actual_savings_eur": r.actual_savings_eur,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in kaizen_result.scalars().all()
        ]

    # 5-Why Analyses (created_by_id == user OR factory_id == user's factory)
    five_why_data: list[dict] = []
    if user_factory_id:
        fw_result = await db.execute(
            select(FiveWhyAnalysis).where(
                (FiveWhyAnalysis.created_by_id == current_user.id)
                | (FiveWhyAnalysis.factory_id == user_factory_id)
            )
            .options(selectinload(FiveWhyAnalysis.steps))
            .offset(offset).limit(limit)
        )
        analyses = fw_result.scalars().unique().all()
        for a in analyses:
            five_why_data.append({
                "id": a.id,
                "factory_id": a.factory_id,
                "title": a.title,
                "problem_statement": a.problem_statement,
                "status": a.status,
                "root_cause": a.root_cause,
                "countermeasure": a.countermeasure,
                "created_by_id": a.created_by_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "steps": [
                    {
                        "step_number": s.step_number,
                        "why_question": s.why_question,
                        "answer": s.answer,
                    }
                    for s in a.steps
                ],
            })

    await log_audit(
        db, action="data_export_request", resource_type="privacy",
        user_id=current_user.id, user_email=current_user.email,
        factory_id=current_user.factory_id,
        ip_address=get_client_ip(request),
        legal_basis="GDPR Art. 20 — right to data portability",
        data_categories="identity,contact,consent,activity,ai_conversations,production,quality,lean",
    )
    await db.commit()

    return {
        "export_format": "JSON",
        "export_date": datetime.now(timezone.utc).isoformat(),
        "pagination": {"limit": limit, "offset": offset},
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
        "audit_logs": [
            {
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "action": a.action,
                "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "detail": a.detail,
                "ip_address": a.ip_address,
                "legal_basis": a.legal_basis,
            }
            for a in audit_entries
        ],
        "factory_production_data": {
            "oee_records": oee_data,
            "production_records": prod_data,
            "downtime_events": downtime_data,
            "scrap_records": scrap_data,
            "quality_records": qc_data,
            "kaizen_items": kaizen_data,
            "five_why_analyses": five_why_data,
        },
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
    from app.core.security import verify_password_async
    if not await verify_password_async(body.password, current_user.hashed_password):
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


# ---------------------------------------------------------------------------
# Sub-processors — GDPR Art. 28 transparency
# ---------------------------------------------------------------------------

SUB_PROCESSORS = [
    {
        "name": "Hetzner Cloud",
        "location": "EU (Germany/Finland)",
        "purpose": "Infrastructure hosting — application servers, databases, backups",
        "dpa_signed": True,
        "privacy_url": "https://www.hetzner.com/legal/privacy-policy",
    },
    {
        "name": "OpenAI",
        "location": "US (with EU Data Processing Addendum)",
        "purpose": "AI-powered suggestions — root cause analysis, kaizen recommendations",
        "dpa_signed": True,
        "privacy_url": "https://openai.com/policies/privacy-policy",
    },
    {
        "name": "Stripe",
        "location": "EU/US (with Standard Contractual Clauses)",
        "purpose": "Payment processing — subscription billing, invoicing",
        "dpa_signed": True,
        "privacy_url": "https://stripe.com/privacy",
    },
]


@router.get("/sub-processors")
async def get_sub_processors(user=Depends(get_current_user)):
    """
    GDPR Art. 28 — Sub-processor transparency.
    Returns the list of third-party sub-processors that process personal data
    on behalf of the data controller, including their location, purpose,
    DPA status, and privacy policy URL.
    """
    return {
        "data_controller": "Centro Studi Grassi doo",
        "legal_basis": "GDPR Art. 28 — sub-processor transparency",
        "last_updated": "2026-03-01",
        "sub_processors": SUB_PROCESSORS,
    }
