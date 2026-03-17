from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.production import ProductionRecord, DowntimeEvent, ScrapRecord
from app.models.factory import ProductionLine
from app.schemas.production import (
    ProductionRecordCreate, ProductionRecordResponse,
    DowntimeEventCreate, ScrapRecordCreate,
)
from app.services.oee_calculator import OEECalculator

router = APIRouter(prefix="/production", tags=["production"])


async def _verify_line_belongs_to_factory(db: AsyncSession, line_id: int, factory_id: int):
    """Ensure the production line belongs to the user's factory (tenant isolation)."""
    result = await db.execute(
        select(ProductionLine).where(
            ProductionLine.id == line_id,
            ProductionLine.factory_id == factory_id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=403, detail="Production line not in your factory")
    return line


@router.post("/records", response_model=ProductionRecordResponse)
async def create_production_record(
    data: ProductionRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_belongs_to_factory(db, data.production_line_id, fid)

    record = ProductionRecord(
        production_line_id=data.production_line_id,
        shift_id=data.shift_id,
        recorded_by_id=user.id,
        date=data.date,
        planned_production_time_min=data.planned_production_time_min,
        actual_run_time_min=data.actual_run_time_min,
        total_pieces=data.total_pieces,
        good_pieces=data.good_pieces,
        ideal_cycle_time_sec=data.ideal_cycle_time_sec,
        notes=data.notes,
    )
    db.add(record)
    await db.flush()

    # Auto-calculate OEE
    await OEECalculator.calculate_and_store(db, record)

    return record


@router.get("/records")
async def list_production_records(
    line_id: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    # Only show records from production lines belonging to user's factory
    query = (
        select(ProductionRecord)
        .join(ProductionLine, ProductionRecord.production_line_id == ProductionLine.id)
        .where(ProductionLine.factory_id == fid)
        .order_by(ProductionRecord.date.desc())
        .limit(limit)
    )
    if line_id:
        await _verify_line_belongs_to_factory(db, line_id, fid)
        query = query.where(ProductionRecord.production_line_id == line_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/downtime")
async def create_downtime_event(
    data: DowntimeEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_belongs_to_factory(db, data.production_line_id, fid)

    event = DowntimeEvent(
        production_line_id=data.production_line_id,
        production_record_id=data.production_record_id,
        recorded_by_id=user.id,
        start_time=data.start_time,
        end_time=data.end_time,
        duration_minutes=data.duration_minutes,
        category=data.category,
        reason=data.reason,
        machine=data.machine,
        notes=data.notes,
    )
    db.add(event)
    await db.flush()
    return {"id": event.id, "status": "created"}


@router.post("/scrap")
async def create_scrap_record(
    data: ScrapRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_belongs_to_factory(db, data.production_line_id, fid)

    record = ScrapRecord(
        production_line_id=data.production_line_id,
        production_record_id=data.production_record_id,
        recorded_by_id=user.id,
        date=data.date,
        quantity=data.quantity,
        defect_type=data.defect_type,
        defect_description=data.defect_description,
        cost_estimate=data.cost_estimate,
        root_cause=data.root_cause,
    )
    db.add(record)
    await db.flush()
    return {"id": record.id, "status": "created"}
