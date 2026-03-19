"""Safety Incident Tracking — log, list, update, and analyse safety events."""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.safety import SafetyIncident
from app.schemas.safety import (
    SafetyIncidentCreate, SafetyIncidentUpdate, SafetyIncidentResponse,
)

router = APIRouter(prefix="/safety", tags=["Safety"])


@router.post("/incidents", response_model=SafetyIncidentResponse)
async def create_incident(
    data: SafetyIncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    incident = SafetyIncident(
        factory_id=require_factory(current_user),
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


@router.get("/incidents", response_model=list[SafetyIncidentResponse])
async def list_incidents(
    incident_type: str = Query(None),
    severity: str = Query(None),
    status: str = Query(None),
    line_id: int = Query(None),
    date_from: date = Query(None),
    date_to: date = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SafetyIncident).where(SafetyIncident.factory_id == require_factory(current_user))
    if incident_type:
        q = q.where(SafetyIncident.incident_type == incident_type)
    if severity:
        q = q.where(SafetyIncident.severity == severity)
    if status:
        q = q.where(SafetyIncident.status == status)
    if line_id:
        q = q.where(SafetyIncident.production_line_id == line_id)
    if date_from:
        q = q.where(SafetyIncident.date >= date_from)
    if date_to:
        q = q.where(SafetyIncident.date <= date_to)
    q = q.order_by(SafetyIncident.date.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/incidents/{incident_id}", response_model=SafetyIncidentResponse)
async def update_incident(
    incident_id: int,
    data: SafetyIncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(SafetyIncident).where(
            SafetyIncident.id == incident_id,
            SafetyIncident.factory_id == require_factory(current_user),
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(incident, k, v)
    await db.commit()
    await db.refresh(incident)
    return incident


@router.delete("/incidents/{incident_id}")
async def delete_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(SafetyIncident).where(
            SafetyIncident.id == incident_id,
            SafetyIncident.factory_id == require_factory(current_user),
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    await db.delete(incident)
    await db.commit()
    return {"ok": True}


@router.get("/stats")
async def get_stats(
    line_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fid = require_factory(current_user)
    base_where = [SafetyIncident.factory_id == fid]
    if line_id:
        base_where.append(SafetyIncident.production_line_id == line_id)

    # Total count via SQL
    total_result = await db.execute(
        select(func.count(SafetyIncident.id)).where(*base_where)
    )
    total = total_result.scalar() or 0

    # Open count via SQL
    open_result = await db.execute(
        select(func.count(SafetyIncident.id)).where(
            *base_where,
            SafetyIncident.status.in_(("open", "investigating")),
        )
    )
    open_count = open_result.scalar() or 0

    # Days without incident — only need the most recent date
    today = date.today()
    last_date_result = await db.execute(
        select(func.max(SafetyIncident.date)).where(*base_where)
    )
    last_date = last_date_result.scalar()
    days_without = (today - last_date).days if last_date else 0

    # Count by type via SQL GROUP BY
    type_result = await db.execute(
        select(SafetyIncident.incident_type, func.count(SafetyIncident.id))
        .where(*base_where)
        .group_by(SafetyIncident.incident_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # Count by severity via SQL GROUP BY
    sev_result = await db.execute(
        select(SafetyIncident.severity, func.count(SafetyIncident.id))
        .where(*base_where)
        .group_by(SafetyIncident.severity)
    )
    by_severity = {row[0]: row[1] for row in sev_result.all()}

    return {
        "days_without_incident": days_without,
        "total_incidents": total,
        "open_count": open_count,
        "by_type": by_type,
        "by_severity": by_severity,
    }
