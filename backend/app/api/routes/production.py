from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.production import ProductionRecord, DowntimeEvent, ScrapRecord
from app.models.factory import ProductionLine
from app.models.manufacturing import ProductionOrder, BOMHeader
from app.schemas.production import (
    ProductionRecordCreate, ProductionRecordResponse,
    DowntimeEventCreate, ScrapRecordCreate,
)
from app.services.oee_calculator import OEECalculator
import structlog

logger = structlog.get_logger(__name__)

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

    # If a production order is specified, auto-populate from BOM
    ideal_cycle = data.ideal_cycle_time_sec
    product_id = data.product_id
    if data.production_order_id:
        po_result = await db.execute(
            select(ProductionOrder).where(
                ProductionOrder.id == data.production_order_id,
                ProductionOrder.factory_id == fid,
            )
        )
        po = po_result.scalar_one_or_none()
        if po:
            product_id = product_id or po.product_id
            if po.bom_id and not data.ideal_cycle_time_sec:
                bom_result = await db.execute(
                    select(BOMHeader.ideal_cycle_time_sec).where(BOMHeader.id == po.bom_id)
                )
                bom_cycle = bom_result.scalar()
                if bom_cycle:
                    ideal_cycle = bom_cycle

    record = ProductionRecord(
        production_line_id=data.production_line_id,
        shift_id=data.shift_id,
        production_order_id=data.production_order_id,
        product_id=product_id,
        recorded_by_id=user.id,
        date=data.date,
        planned_production_time_min=data.planned_production_time_min,
        actual_run_time_min=data.actual_run_time_min,
        total_pieces=data.total_pieces,
        good_pieces=data.good_pieces,
        ideal_cycle_time_sec=ideal_cycle,
        notes=data.notes,
    )
    db.add(record)
    await db.flush()

    # Auto-calculate OEE
    await OEECalculator.calculate_and_store(db, record)

    # Update production order totals if linked
    if data.production_order_id and po:
        scrap = data.total_pieces - data.good_pieces
        po.actual_quantity_good = (po.actual_quantity_good or 0) + data.good_pieces
        po.actual_quantity_scrap = (po.actual_quantity_scrap or 0) + scrap
        # Auto-complete if target reached
        if po.actual_quantity_good >= po.planned_quantity and po.status == "in_progress":
            po.status = "completed"
            logger.info("production_order.auto_completed", order_id=po.id, good=po.actual_quantity_good, planned=po.planned_quantity)
        # Auto QC hold if scrap rate > 5%
        total_produced = po.actual_quantity_good + po.actual_quantity_scrap
        if total_produced > 0 and not po.qc_hold:
            scrap_rate = po.actual_quantity_scrap / total_produced
            if scrap_rate > 0.05:
                po.qc_hold = True
                po.qc_hold_reason = f"Auto-hold: scrap rate {scrap_rate:.1%} exceeds 5% threshold"
                logger.warning("production_order.auto_qc_hold", order_id=po.id, scrap_rate=f"{scrap_rate:.1%}")

    await db.commit()

    return record


@router.get("/active-orders")
async def list_active_orders_for_line(
    line_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List active production orders for a line (for the PO dropdown in ProductionInput)."""
    fid = require_factory(user)
    await _verify_line_belongs_to_factory(db, line_id, fid)
    from app.models.manufacturing import Product
    q = (
        select(
            ProductionOrder.id,
            ProductionOrder.order_number,
            ProductionOrder.status,
            ProductionOrder.planned_quantity,
            ProductionOrder.actual_quantity_good,
            ProductionOrder.product_id,
            Product.name.label("product_name"),
            ProductionOrder.bom_id,
        )
        .outerjoin(Product, ProductionOrder.product_id == Product.id)
        .where(
            ProductionOrder.factory_id == fid,
            ProductionOrder.production_line_id == line_id,
            ProductionOrder.status.in_(["released", "in_progress"]),
        )
        .order_by(ProductionOrder.created_at.desc())
    )
    result = await db.execute(q)
    rows = result.all()
    orders = []
    for r in rows:
        bom_cycle = None
        if r.bom_id:
            bom_q = await db.execute(select(BOMHeader.ideal_cycle_time_sec).where(BOMHeader.id == r.bom_id))
            bom_cycle = bom_q.scalar()
        orders.append({
            "id": r.id,
            "order_number": r.order_number,
            "status": r.status,
            "planned_quantity": r.planned_quantity,
            "actual_quantity_good": r.actual_quantity_good,
            "product_id": r.product_id,
            "product_name": r.product_name,
            "ideal_cycle_time_sec": bom_cycle,
        })
    return orders


@router.get("/records")
async def list_production_records(
    line_id: int | None = None,
    limit: int = Query(50, le=200),
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
    records = result.scalars().all()
    # Manually serialize ORM objects to dicts to avoid JSON serialization errors
    return [
        {
            "id": r.id,
            "production_line_id": r.production_line_id,
            "shift_id": r.shift_id,
            "date": r.date.isoformat() if r.date else None,
            "planned_production_time_min": r.planned_production_time_min,
            "actual_run_time_min": r.actual_run_time_min,
            "total_pieces": r.total_pieces,
            "good_pieces": r.good_pieces,
            "ideal_cycle_time_sec": r.ideal_cycle_time_sec,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


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
    await db.commit()
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
    await db.commit()
    return {"id": record.id, "status": "created"}
