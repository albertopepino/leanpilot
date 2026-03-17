"""Audit Scheduling — 6S/TPM/QC/Gemba schedule management."""
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.audit_schedule import AuditSchedule
from app.schemas.audit_schedule import (
    AuditScheduleCreate, AuditScheduleUpdate, AuditScheduleResponse,
)

router = APIRouter(prefix="/audit-schedules", tags=["Audit Schedules"])


@router.post("/", response_model=AuditScheduleResponse)
async def create_schedule(
    data: AuditScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    schedule = AuditSchedule(
        factory_id=current_user.factory_id,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get("/", response_model=list[AuditScheduleResponse])
async def list_schedules(
    audit_type: str = Query(None),
    active_only: bool = Query(True),
    overdue_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(AuditSchedule).where(
        AuditSchedule.factory_id == current_user.factory_id
    )
    if audit_type:
        q = q.where(AuditSchedule.audit_type == audit_type)
    if active_only:
        q = q.where(AuditSchedule.is_active == True)
    if overdue_only:
        q = q.where(AuditSchedule.next_due_date < date.today())
    q = q.order_by(AuditSchedule.next_due_date)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{schedule_id}", response_model=AuditScheduleResponse)
async def update_schedule(
    schedule_id: int,
    data: AuditScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(AuditSchedule).where(
            AuditSchedule.id == schedule_id,
            AuditSchedule.factory_id == current_user.factory_id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(schedule, k, v)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.post("/{schedule_id}/complete", response_model=AuditScheduleResponse)
async def mark_completed(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Mark audit as completed, advance next_due_date based on frequency."""
    from datetime import timedelta
    result = await db.execute(
        select(AuditSchedule).where(
            AuditSchedule.id == schedule_id,
            AuditSchedule.factory_id == current_user.factory_id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    schedule.last_completed_date = date.today()

    freq_days = {
        "daily": 1, "weekly": 7, "biweekly": 14,
        "monthly": 30, "quarterly": 90,
    }
    delta = freq_days.get(schedule.frequency, 30)
    schedule.next_due_date = date.today() + timedelta(days=delta)

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(AuditSchedule).where(
            AuditSchedule.id == schedule_id,
            AuditSchedule.factory_id == current_user.factory_id,
        )
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")
    await db.delete(schedule)
    await db.commit()
    return {"ok": True}
