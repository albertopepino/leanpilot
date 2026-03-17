"""Safety Incident Tracking — log, list, update, and analyse safety events."""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.security import get_current_user
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
        factory_id=current_user.factory_id,
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
    limit: int = Query(200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SafetyIncident).where(SafetyIncident.factory_id == current_user.factory_id)
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
    q = q.order_by(SafetyIncident.date.desc()).limit(limit)
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
            SafetyIncident.factory_id == current_user.factory_id,
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
            SafetyIncident.factory_id == current_user.factory_id,
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
    base = select(SafetyIncident).where(SafetyIncident.factory_id == current_user.factory_id)
    if line_id:
        base = base.where(SafetyIncident.production_line_id == line_id)

    # All incidents
    result = await db.execute(base.order_by(SafetyIncident.date.desc()))
    incidents = result.scalars().all()

    total = len(incidents)
    open_count = sum(1 for i in incidents if i.status in ("open", "investigating"))

    # Days without incident
    today = date.today()
    if total > 0:
        last_date = incidents[0].date
        days_without = (today - last_date).days
    else:
        days_without = 0

    # Count by type
    by_type: dict[str, int] = {}
    for inc in incidents:
        by_type[inc.incident_type] = by_type.get(inc.incident_type, 0) + 1

    # Count by severity
    by_severity: dict[str, int] = {}
    for inc in incidents:
        by_severity[inc.severity] = by_severity.get(inc.severity, 0) + 1

    return {
        "days_without_incident": days_without,
        "total_incidents": total,
        "open_count": open_count,
        "by_type": by_type,
        "by_severity": by_severity,
    }
