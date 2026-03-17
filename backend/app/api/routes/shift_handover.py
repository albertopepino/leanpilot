"""Shift Handover — auto-generate or manual."""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.shift_handover import ShiftHandover
from app.models.production import ProductionRecord, ScrapRecord, DowntimeEvent
from app.models.lean import OEERecord
from app.schemas.shift_handover import (
    ShiftHandoverCreate, ShiftHandoverUpdate, ShiftHandoverResponse,
)

router = APIRouter(prefix="/shift-handover", tags=["Shift Handover"])


@router.post("/", response_model=ShiftHandoverResponse)
async def create_handover(
    data: ShiftHandoverCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    handover = ShiftHandover(
        factory_id=current_user.factory_id,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(handover)
    await db.commit()
    await db.refresh(handover)
    return handover


@router.post("/auto-generate", response_model=ShiftHandoverResponse)
async def auto_generate_handover(
    line_id: int = Query(...),
    target_date: date = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Auto-generate shift handover from production data."""
    d = target_date or date.today()

    # Get production summary for the line/date
    prod_q = select(
        func.sum(ProductionRecord.total_pieces).label("total"),
        func.sum(ProductionRecord.good_pieces).label("good"),
    ).where(
        and_(
            ProductionRecord.production_line_id == line_id,
            func.date(ProductionRecord.date) == d,
        )
    )
    prod_result = await db.execute(prod_q)
    prod_row = prod_result.one_or_none()

    # Get scrap
    scrap_q = select(func.sum(ScrapRecord.quantity)).where(
        and_(
            ScrapRecord.production_line_id == line_id,
            func.date(ScrapRecord.date) == d,
        )
    )
    scrap_result = await db.execute(scrap_q)
    scrap_total = scrap_result.scalar() or 0

    # Get downtime
    dt_q = select(func.sum(DowntimeEvent.duration_min)).where(
        and_(
            DowntimeEvent.production_line_id == line_id,
            func.date(DowntimeEvent.start_time) == d,
        )
    )
    dt_result = await db.execute(dt_q)
    dt_total = dt_result.scalar() or 0

    # Get latest OEE
    oee_q = select(OEERecord.oee).where(
        and_(
            OEERecord.production_line_id == line_id,
            func.date(OEERecord.date) == d,
        )
    ).order_by(OEERecord.created_at.desc()).limit(1)
    oee_result = await db.execute(oee_q)
    oee_val = oee_result.scalar()

    handover = ShiftHandover(
        factory_id=current_user.factory_id,
        production_line_id=line_id,
        created_by_id=current_user.id,
        date=d,
        status="draft",
        total_pieces=prod_row.total if prod_row and prod_row.total else 0,
        good_pieces=prod_row.good if prod_row and prod_row.good else 0,
        scrap_pieces=scrap_total,
        oee_pct=oee_val,
        downtime_min=dt_total,
    )
    db.add(handover)
    await db.commit()
    await db.refresh(handover)
    return handover


@router.get("/", response_model=list[ShiftHandoverResponse])
async def list_handovers(
    line_id: int = Query(None),
    target_date: date = Query(None),
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(ShiftHandover).where(ShiftHandover.factory_id == current_user.factory_id)
    if line_id:
        q = q.where(ShiftHandover.production_line_id == line_id)
    if target_date:
        q = q.where(ShiftHandover.date == target_date)
    q = q.order_by(ShiftHandover.date.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{handover_id}", response_model=ShiftHandoverResponse)
async def update_handover(
    handover_id: int,
    data: ShiftHandoverUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ShiftHandover).where(
            ShiftHandover.id == handover_id,
            ShiftHandover.factory_id == current_user.factory_id,
        )
    )
    handover = result.scalar_one_or_none()
    if not handover:
        raise HTTPException(404, "Handover not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(handover, k, v)
    await db.commit()
    await db.refresh(handover)
    return handover


@router.post("/{handover_id}/acknowledge", response_model=ShiftHandoverResponse)
async def acknowledge_handover(
    handover_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ShiftHandover).where(
            ShiftHandover.id == handover_id,
            ShiftHandover.factory_id == current_user.factory_id,
        )
    )
    handover = result.scalar_one_or_none()
    if not handover:
        raise HTTPException(404, "Handover not found")
    handover.status = "acknowledged"
    handover.acknowledged_by_id = current_user.id
    handover.acknowledged_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(handover)
    return handover
