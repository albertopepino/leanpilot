"""
Admin routes — user management, audit logs, permissions config, data export.
All endpoints require ADMIN role + tenant isolation.
"""
import json
import secrets
import structlog
from datetime import date, datetime, timezone
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.config import get_settings
from app.core.security import (
    get_current_active_admin, get_current_user, get_password_hash,
    require_factory, log_audit, get_client_ip,
)
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.models.factory import Factory, ProductionLine, Shift
from app.models.production import ProductionRecord
from app.models.lean import (
    OEERecord, FiveWhyAnalysis, FiveWhyStep, IshikawaAnalysis, IshikawaCause,
    KaizenItem, SMEDRecord, SMEDStep, LeanAssessment,
)
from pydantic import BaseModel
from app.schemas.admin import (
    AdminUserCreate, AdminUserUpdate, AdminUserResponse,
    AdminResetPasswordResponse, AuditLogEntry, TAB_PERMISSIONS,
    PERMISSION_RANK, RANK_PERMISSION,
)


class ProductionLineCreate(BaseModel):
    name: str
    product_type: str | None = None
    target_oee: float = 85.0
    target_cycle_time_seconds: float | None = None
    is_active: bool = True


class ProductionLineUpdate(BaseModel):
    name: str | None = None
    product_type: str | None = None
    target_oee: float | None = None
    target_cycle_time_seconds: float | None = None
    is_active: bool | None = None


class ShiftCreate(BaseModel):
    production_line_id: int
    name: str
    start_hour: int = 6
    end_hour: int = 14
    planned_minutes: int = 480


class ShiftUpdate(BaseModel):
    name: str | None = None
    start_hour: int | None = None
    end_hour: int | None = None
    planned_minutes: int | None = None

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()

_VALID_ROLES = {r.value for r in UserRole}


# ---------------------------------------------------------------------------
# Users — list, create, update, reset password
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """List all users in the admin's factory (tenant-scoped)."""
    fid = require_factory(admin)
    result = await db.execute(
        select(User)
        .where(User.factory_id == fid, User.is_deleted == False)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [AdminUserResponse.model_validate(u) for u in users]


@router.post("/users", response_model=AdminUserResponse)
async def create_user(
    request: Request,
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Create a new user within the admin's factory."""
    fid = require_factory(admin)

    if data.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(_VALID_ROLES)}")
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    password = data.password or secrets.token_urlsafe(12)

    user = User(
        email=data.email,
        hashed_password=get_password_hash(password),
        full_name=data.full_name,
        role=data.role,
        language=data.language,
        factory_id=fid,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await log_audit(
        db, action="admin_user_created", resource_type="user",
        resource_id=str(user.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Created user {data.email} with role {data.role}",
        legal_basis="GDPR Art. 6(1)(b) — contract performance",
        data_categories="identity,contact",
    )
    await db.commit()

    return AdminUserResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: int,
    request: Request,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update a user's role, active status, name, or language."""
    fid = require_factory(admin)

    result = await db.execute(
        select(User).where(User.id == user_id, User.factory_id == fid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in your factory")

    # Prevent admin from demoting themselves
    if user.id == admin.id and data.role and data.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own admin role")
    if user.id == admin.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    changes = []
    if data.role is not None:
        if data.role not in _VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role")
        old = user.role.value if hasattr(user.role, "value") else user.role
        user.role = data.role
        changes.append(f"role: {old} → {data.role}")

    if data.is_active is not None:
        user.is_active = data.is_active
        changes.append(f"is_active: {data.is_active}")

    if data.language is not None:
        user.language = data.language
        changes.append(f"language: {data.language}")

    if data.full_name is not None:
        user.full_name = data.full_name
        changes.append(f"full_name updated")

    if changes:
        await log_audit(
            db, action="admin_user_updated", resource_type="user",
            resource_id=str(user.id), user_id=admin.id, user_email=admin.email,
            factory_id=fid, ip_address=get_client_ip(request),
            detail="; ".join(changes),
        )
        await db.commit()

    return AdminUserResponse.model_validate(user)


@router.post("/users/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
async def reset_user_password(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Generate a new temporary password for a user."""
    fid = require_factory(admin)

    result = await db.execute(
        select(User).where(User.id == user_id, User.factory_id == fid)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in your factory")

    temp_password = secrets.token_urlsafe(12)
    user.hashed_password = get_password_hash(temp_password)
    user.password_changed_at = datetime.now(timezone.utc)
    # Unlock if locked
    user.failed_login_attempts = 0
    user.locked_until = None

    await log_audit(
        db, action="admin_password_reset", resource_type="user",
        resource_id=str(user.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Password reset for {user.email}",
        legal_basis="GDPR Art. 32 — security of processing",
    )
    await db.commit()

    return AdminResetPasswordResponse(
        detail=f"Password reset for {user.email}",
        temporary_password=temp_password,
    )


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/audit-logs", response_model=list[AuditLogEntry])
async def list_audit_logs(
    action: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """View factory audit logs (admin only, tenant-scoped)."""
    fid = require_factory(admin)

    query = select(AuditLog).where(AuditLog.factory_id == fid)
    if action:
        query = query.where(AuditLog.action == action)
    query = query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()
    return [AuditLogEntry.model_validate(log) for log in logs]


# ---------------------------------------------------------------------------
# Tab/Permission config — served to frontend
# ---------------------------------------------------------------------------

def _merged_permissions(custom: dict | None) -> dict:
    """Merge factory custom permissions on top of defaults."""
    import copy
    merged = copy.deepcopy(TAB_PERMISSIONS)
    if custom:
        for role, tabs in custom.items():
            if role in merged and isinstance(tabs, dict):
                merged[role].update(tabs)
    return merged


@router.get("/permissions")
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Return the full tab-permission matrix for all roles."""
    from app.models.factory import Factory
    factory = (await db.execute(select(Factory).where(Factory.id == admin.factory_id))).scalar_one_or_none()
    merged = _merged_permissions(factory.custom_permissions if factory else None)
    return {
        "roles": list(merged.keys()),
        "permissions": merged,
    }


class PermissionUpdate(BaseModel):
    """Typed model for custom permission overrides: { role: { tab_id: level } }."""
    permissions: dict[str, dict[str, str]]


@router.put("/permissions")
async def update_permissions(
    data: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Save custom permission overrides for this factory."""
    from app.models.factory import Factory
    factory = (await db.execute(select(Factory).where(Factory.id == admin.factory_id))).scalar_one_or_none()
    if not factory:
        raise HTTPException(404, "Factory not found")
    # Validate structure: { role: { tab: level } }
    valid_levels = {"full", "modify", "view", "hidden"}
    custom = {}
    for role, tabs in data.permissions.items():
        if isinstance(tabs, dict):
            custom[role] = {k: v for k, v in tabs.items() if v in valid_levels}
    factory.custom_permissions = custom
    await db.commit()
    return {"ok": True}


@router.get("/my-permissions")
async def get_my_permissions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return tab permissions for the current user.

    Checks group policies first — when a user belongs to one or more groups,
    the highest permission level per tab wins (full > modify > view > hidden).
    Falls back to role-based TAB_PERMISSIONS if the user has no group memberships.
    """
    from app.models.groups import Group, GroupPolicy, user_groups

    role = user.role.value if hasattr(user.role, "value") else user.role
    from app.models.factory import Factory
    factory = (await db.execute(select(Factory).where(Factory.id == user.factory_id))).scalar_one_or_none()
    merged = _merged_permissions(factory.custom_permissions if factory else None)
    role_perms = merged.get(role, merged.get("viewer", {}))

    # Check group policies for this user
    group_result = await db.execute(
        select(GroupPolicy)
        .join(Group, GroupPolicy.group_id == Group.id)
        .join(user_groups, user_groups.c.group_id == Group.id)
        .where(
            user_groups.c.user_id == user.id,
            Group.is_active == True,
        )
    )
    group_policies = group_result.scalars().all()

    if not group_policies:
        # No group memberships — fall back to role-based permissions
        return {
            "role": role,
            "permissions": role_perms,
        }

    # Merge: take highest permission per tab across all groups
    merged: dict[str, int] = {}
    for gp in group_policies:
        rank = PERMISSION_RANK.get(gp.permission, 0)
        if gp.tab_id not in merged or rank > merged[gp.tab_id]:
            merged[gp.tab_id] = rank

    # Convert ranks back to permission strings, falling back to role perms for
    # tabs not covered by any group policy
    perms = dict(role_perms)
    for tab_id, rank in merged.items():
        perms[tab_id] = RANK_PERMISSION[rank]

    return {
        "role": role,
        "permissions": perms,
    }


# ---------------------------------------------------------------------------
# Factory info
# ---------------------------------------------------------------------------

@router.get("/factory")
async def get_factory_info(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get factory details — accessible to any authenticated user.

    Used by OEE Dashboard, Production Input, Production Orders, Andon Board,
    QC Dashboard, SPC Charts, and other components that need production line data.
    """
    fid = require_factory(user)
    try:
        result = await db.execute(select(Factory).where(Factory.id == fid))
        factory = result.scalar_one_or_none()
        if not factory:
            raise HTTPException(status_code=404, detail="Factory not found")

        user_count_result = await db.execute(
            select(func.count(User.id)).where(User.factory_id == fid, User.is_deleted == False)
        )

        lines_result = await db.execute(
            select(ProductionLine).where(ProductionLine.factory_id == fid).order_by(ProductionLine.name)
        )
        lines = lines_result.scalars().all()

        return {
            "id": factory.id,
            "name": factory.name,
            "user_count": user_count_result.scalar() or 0,
            "data_controller": "Centro Studi Grassi doo",
            "production_lines": [{"id": l.id, "name": l.name} for l in lines],
        }
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("factory_info_failed", error=str(e), factory_id=fid, user_id=user.id)
        raise HTTPException(status_code=500, detail="Failed to load factory info")


# ---------------------------------------------------------------------------
# Production Lines — CRUD for factory setup
# ---------------------------------------------------------------------------

@router.get("/production-lines")
async def list_production_lines(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """List all production lines in the admin's factory with their shifts."""
    fid = require_factory(admin)
    result = await db.execute(
        select(ProductionLine)
        .where(ProductionLine.factory_id == fid)
        .options(selectinload(ProductionLine.shifts))
        .order_by(ProductionLine.name)
    )
    lines = result.scalars().unique().all()
    return [
        {
            "id": l.id,
            "name": l.name,
            "product_type": l.product_type,
            "target_oee": l.target_oee,
            "target_cycle_time_seconds": l.target_cycle_time_seconds,
            "is_active": l.is_active,
            "shifts": [
                {
                    "id": s.id,
                    "name": s.name,
                    "start_hour": s.start_hour,
                    "end_hour": s.end_hour,
                    "planned_minutes": s.planned_minutes,
                }
                for s in (l.shifts or [])
            ],
        }
        for l in lines
    ]


@router.post("/production-lines")
async def create_production_line(
    request: Request,
    data: ProductionLineCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Create a new production line."""
    fid = require_factory(admin)
    line = ProductionLine(
        factory_id=fid,
        name=data.name,
        product_type=data.product_type,
        target_oee=data.target_oee,
        target_cycle_time_seconds=data.target_cycle_time_seconds,
        is_active=data.is_active,
    )
    db.add(line)
    await db.flush()
    await log_audit(
        db, action="production_line_created", resource_type="production_line",
        resource_id=str(line.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Created production line '{line.name}'",
    )
    await db.commit()
    return {"id": line.id, "name": line.name, "is_active": line.is_active}


@router.patch("/production-lines/{line_id}")
async def update_production_line(
    line_id: int,
    request: Request,
    data: ProductionLineUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update a production line."""
    fid = require_factory(admin)
    result = await db.execute(
        select(ProductionLine).where(ProductionLine.id == line_id, ProductionLine.factory_id == fid)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Production line not found")

    changes = []
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(line, field)
        setattr(line, field, value)
        changes.append(f"{field}: {old} → {value}")

    if changes:
        await log_audit(
            db, action="production_line_updated", resource_type="production_line",
            resource_id=str(line.id), user_id=admin.id, user_email=admin.email,
            factory_id=fid, ip_address=get_client_ip(request),
            detail="; ".join(changes),
        )
        await db.commit()
    return {"id": line.id, "name": line.name, "is_active": line.is_active}


@router.delete("/production-lines/{line_id}")
async def delete_production_line(
    line_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Soft-delete (deactivate) a production line."""
    fid = require_factory(admin)
    result = await db.execute(
        select(ProductionLine).where(ProductionLine.id == line_id, ProductionLine.factory_id == fid)
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Production line not found")

    line.is_active = False
    await log_audit(
        db, action="production_line_deleted", resource_type="production_line",
        resource_id=str(line.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Deactivated production line '{line.name}'",
    )
    await db.commit()
    return {"status": "deactivated"}


# ---------------------------------------------------------------------------
# Shifts — CRUD
# ---------------------------------------------------------------------------

@router.post("/shifts")
async def create_shift(
    request: Request,
    data: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Create a shift for a production line."""
    fid = require_factory(admin)

    # Verify line belongs to factory
    result = await db.execute(
        select(ProductionLine).where(ProductionLine.id == data.production_line_id, ProductionLine.factory_id == fid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Production line not found")

    shift = Shift(
        production_line_id=data.production_line_id,
        name=data.name,
        start_hour=data.start_hour,
        end_hour=data.end_hour,
        planned_minutes=data.planned_minutes,
    )
    db.add(shift)
    await db.flush()
    await log_audit(
        db, action="shift_created", resource_type="shift",
        resource_id=str(shift.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Created shift '{shift.name}' for line {data.production_line_id}",
    )
    await db.commit()
    return {"id": shift.id, "name": shift.name}


@router.patch("/shifts/{shift_id}")
async def update_shift(
    shift_id: int,
    request: Request,
    data: ShiftUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update a shift."""
    fid = require_factory(admin)
    result = await db.execute(
        select(Shift)
        .join(ProductionLine)
        .where(Shift.id == shift_id, ProductionLine.factory_id == fid)
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(shift, field, value)

    await db.commit()
    return {"id": shift.id, "name": shift.name}


@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Delete a shift."""
    fid = require_factory(admin)
    result = await db.execute(
        select(Shift)
        .join(ProductionLine)
        .where(Shift.id == shift_id, ProductionLine.factory_id == fid)
    )
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    await db.delete(shift)
    await log_audit(
        db, action="shift_deleted", resource_type="shift",
        resource_id=str(shift_id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Deleted shift '{shift.name}'",
    )
    await db.commit()
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Full data export — GDPR Art. 20 data portability
# ---------------------------------------------------------------------------

_SENSITIVE_FIELDS = frozenset({"hashed_password"})


def _row_to_dict(row, *, exclude: frozenset[str] = _SENSITIVE_FIELDS) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-safe dict.

    Handles datetime serialisation and excludes sensitive fields.
    Enum values are converted to their string representation.
    """
    data: dict = {}
    for col in row.__table__.columns:
        if col.name in exclude:
            continue
        val = getattr(row, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        elif isinstance(val, date):
            val = val.isoformat()
        elif isinstance(val, Enum):
            val = val.value
        data[col.name] = val
    return data


def _rows_to_list(rows, **kwargs) -> list[dict]:
    return [_row_to_dict(r, **kwargs) for r in rows]


@router.get("/export-data")
async def export_factory_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Export all factory-scoped data as a downloadable JSON file.

    GDPR Art. 20 — Right to data portability.
    Returns a structured, machine-readable export of all data belonging
    to the admin's factory, suitable for migration or archival purposes.
    Sensitive fields (e.g. hashed_password) are excluded from the output.
    """
    fid = require_factory(admin)

    # --- Factory ---------------------------------------------------------------
    fac_result = await db.execute(select(Factory).where(Factory.id == fid))
    factory = fac_result.scalar_one_or_none()

    # --- Users (exclude hashed_password) ---------------------------------------
    users_result = await db.execute(
        select(User).where(User.factory_id == fid).order_by(User.id)
    )
    users = users_result.scalars().all()

    # --- Production Lines ------------------------------------------------------
    lines_result = await db.execute(
        select(ProductionLine).where(ProductionLine.factory_id == fid).order_by(ProductionLine.id)
    )
    production_lines = lines_result.scalars().all()
    line_ids = [pl.id for pl in production_lines]

    # --- Production Records (scoped via production_line_id) --------------------
    prod_result = await db.execute(
        select(ProductionRecord)
        .where(ProductionRecord.production_line_id.in_(line_ids))
        .order_by(ProductionRecord.id)
    ) if line_ids else None
    production_records = prod_result.scalars().all() if prod_result else []

    # --- OEE Records (scoped via production_line_id) ---------------------------
    oee_result = await db.execute(
        select(OEERecord)
        .where(OEERecord.production_line_id.in_(line_ids))
        .order_by(OEERecord.id)
    ) if line_ids else None
    oee_records = oee_result.scalars().all() if oee_result else []

    # --- 5-Why Analyses + Steps ------------------------------------------------
    fivewhy_result = await db.execute(
        select(FiveWhyAnalysis)
        .where(FiveWhyAnalysis.factory_id == fid)
        .options(selectinload(FiveWhyAnalysis.steps))
        .order_by(FiveWhyAnalysis.id)
    )
    five_why_analyses_raw = fivewhy_result.scalars().unique().all()
    five_why_analyses = []
    for analysis in five_why_analyses_raw:
        d = _row_to_dict(analysis)
        d["steps"] = _rows_to_list(analysis.steps)
        five_why_analyses.append(d)

    # --- Ishikawa Analyses + Causes --------------------------------------------
    ishi_result = await db.execute(
        select(IshikawaAnalysis)
        .where(IshikawaAnalysis.factory_id == fid)
        .options(selectinload(IshikawaAnalysis.causes))
        .order_by(IshikawaAnalysis.id)
    )
    ishikawa_analyses_raw = ishi_result.scalars().unique().all()
    ishikawa_analyses = []
    for analysis in ishikawa_analyses_raw:
        d = _row_to_dict(analysis)
        d["causes"] = _rows_to_list(analysis.causes)
        ishikawa_analyses.append(d)

    # --- Kaizen Items ----------------------------------------------------------
    kaizen_result = await db.execute(
        select(KaizenItem)
        .where(KaizenItem.factory_id == fid)
        .order_by(KaizenItem.id)
    )
    kaizen_items = kaizen_result.scalars().all()

    # --- SMED Records + Steps --------------------------------------------------
    smed_result = await db.execute(
        select(SMEDRecord)
        .where(SMEDRecord.factory_id == fid)
        .options(selectinload(SMEDRecord.steps))
        .order_by(SMEDRecord.id)
    )
    smed_records_raw = smed_result.scalars().unique().all()
    smed_records = []
    for record in smed_records_raw:
        d = _row_to_dict(record)
        d["steps"] = _rows_to_list(record.steps)
        smed_records.append(d)

    # --- Lean Assessments ------------------------------------------------------
    assess_result = await db.execute(
        select(LeanAssessment)
        .where(LeanAssessment.factory_id == fid)
        .order_by(LeanAssessment.id)
    )
    lean_assessments = assess_result.scalars().all()

    # --- Audit Logs ------------------------------------------------------------
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.factory_id == fid)
        .order_by(AuditLog.id)
    )
    audit_logs = audit_result.scalars().all()

    # --- Build export payload --------------------------------------------------
    now = datetime.now(timezone.utc)
    export_payload = {
        "export_metadata": {
            "factory_id": fid,
            "exported_at": now.isoformat(),
            "exported_by": admin.email,
            "version": "1.0",
        },
        "factory": _row_to_dict(factory) if factory else None,
        "users": _rows_to_list(users),
        "production_lines": _rows_to_list(production_lines),
        "production_records": _rows_to_list(production_records),
        "oee_records": _rows_to_list(oee_records),
        "five_why_analyses": five_why_analyses,
        "ishikawa_analyses": ishikawa_analyses,
        "kaizen_items": _rows_to_list(kaizen_items),
        "smed_records": smed_records,
        "lean_assessments": _rows_to_list(lean_assessments),
        "audit_logs": _rows_to_list(audit_logs, exclude=frozenset()),
    }

    # --- Audit the export itself -----------------------------------------------
    await log_audit(
        db,
        action="factory_data_export",
        resource_type="factory",
        resource_id=str(fid),
        user_id=admin.id,
        user_email=admin.email,
        factory_id=fid,
        ip_address=get_client_ip(request),
        detail="Full factory data export (GDPR Art. 20 data portability)",
        legal_basis="GDPR Art. 20 — right to data portability",
        data_categories="personal,production,lean,audit",
    )
    await db.commit()

    # --- Stream as downloadable JSON -------------------------------------------
    today_str = now.strftime("%Y-%m-%d")
    filename = f"factory_export_{fid}_{today_str}.json"

    json_bytes = json.dumps(export_payload, ensure_ascii=False, indent=2).encode("utf-8")

    return StreamingResponse(
        iter([json_bytes]),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
