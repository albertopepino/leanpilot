from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.factory import ProductionLine
from app.models.lean import OEERecord
from app.schemas.lean import OEEResponse, OEESummary
from app.services.oee_calculator import OEECalculator

router = APIRouter(prefix="/oee", tags=["oee"])


async def _verify_line_ownership(db: AsyncSession, line_id: int, factory_id: int):
    from fastapi import HTTPException
    result = await db.execute(
        select(ProductionLine).where(
            ProductionLine.id == line_id,
            ProductionLine.factory_id == factory_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Production line not in your factory")


@router.get("/summary/{line_id}")
async def get_oee_summary(
    line_id: int,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    return await OEECalculator.get_line_summary(db, line_id, days)


@router.get("/trend/{line_id}")
async def get_oee_trend(
    line_id: int,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    return await OEECalculator.get_trend(db, line_id, days)


@router.post("/calculate", response_model=OEEResponse)
async def calculate_oee_manual(
    planned_time_min: float,
    run_time_min: float,
    total_pieces: int,
    good_pieces: int,
    ideal_cycle_time_sec: float,
    user: User = Depends(get_current_user),
):
    """Quick OEE calculation without storing - useful for what-if scenarios."""
    return OEECalculator.calculate_oee(
        planned_time_min, run_time_min, total_pieces, good_pieces, ideal_cycle_time_sec
    )


# ──────────────────────────────────────────────────────────────────────────────
# Consolidated / Factory-wide endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/consolidated/summary")
async def get_consolidated_summary(
    days: int = 30,
    start_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    end_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Factory-wide OEE summary across ALL production lines."""
    fid = require_factory(user)

    # Date range
    if start_date and end_date:
        since = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        until = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        until = datetime.now(timezone.utc)
        since = until - timedelta(days=days)

    # Get all lines for this factory
    lines_result = await db.execute(
        select(ProductionLine).where(ProductionLine.factory_id == fid)
    )
    lines = lines_result.scalars().all()
    line_ids = [l.id for l in lines]

    if not line_ids:
        return {"lines": [], "factory_summary": {
            "avg_oee": 0, "avg_availability": 0, "avg_performance": 0,
            "avg_quality": 0, "record_count": 0, "total_downtime_min": 0,
        }}

    # Per-line summaries
    per_line = []
    for line in lines:
        result = await db.execute(
            select(
                func.avg(OEERecord.oee).label("avg_oee"),
                func.avg(OEERecord.availability).label("avg_availability"),
                func.avg(OEERecord.performance).label("avg_performance"),
                func.avg(OEERecord.quality).label("avg_quality"),
                func.count(OEERecord.id).label("record_count"),
                func.sum(OEERecord.downtime_min).label("total_downtime"),
            )
            .where(OEERecord.production_line_id == line.id)
            .where(OEERecord.date >= since)
            .where(OEERecord.date < until)
        )
        row = result.one()
        per_line.append({
            "line_id": line.id,
            "line_name": line.name,
            "avg_oee": round(row.avg_oee or 0, 2),
            "avg_availability": round(row.avg_availability or 0, 2),
            "avg_performance": round(row.avg_performance or 0, 2),
            "avg_quality": round(row.avg_quality or 0, 2),
            "record_count": row.record_count or 0,
            "total_downtime_min": round(row.total_downtime or 0, 2),
        })

    # Factory-wide aggregation
    factory_result = await db.execute(
        select(
            func.avg(OEERecord.oee).label("avg_oee"),
            func.avg(OEERecord.availability).label("avg_availability"),
            func.avg(OEERecord.performance).label("avg_performance"),
            func.avg(OEERecord.quality).label("avg_quality"),
            func.count(OEERecord.id).label("record_count"),
            func.sum(OEERecord.downtime_min).label("total_downtime"),
        )
        .where(OEERecord.production_line_id.in_(line_ids))
        .where(OEERecord.date >= since)
        .where(OEERecord.date < until)
    )
    frow = factory_result.one()

    return {
        "lines": per_line,
        "factory_summary": {
            "avg_oee": round(frow.avg_oee or 0, 2),
            "avg_availability": round(frow.avg_availability or 0, 2),
            "avg_performance": round(frow.avg_performance or 0, 2),
            "avg_quality": round(frow.avg_quality or 0, 2),
            "record_count": frow.record_count or 0,
            "total_downtime_min": round(frow.total_downtime or 0, 2),
        },
    }


@router.get("/consolidated/trend")
async def get_consolidated_trend(
    days: int = 30,
    start_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    end_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Factory-wide OEE trend, aggregated by date across ALL lines."""
    fid = require_factory(user)

    if start_date and end_date:
        since = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        until = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        until = datetime.now(timezone.utc)
        since = until - timedelta(days=days)

    lines_result = await db.execute(
        select(ProductionLine.id).where(ProductionLine.factory_id == fid)
    )
    line_ids = [r[0] for r in lines_result.all()]

    if not line_ids:
        return []

    result = await db.execute(
        select(
            func.date(OEERecord.date).label("day"),
            func.avg(OEERecord.oee).label("avg_oee"),
            func.avg(OEERecord.availability).label("avg_availability"),
            func.avg(OEERecord.performance).label("avg_performance"),
            func.avg(OEERecord.quality).label("avg_quality"),
            func.count(OEERecord.id).label("count"),
        )
        .where(OEERecord.production_line_id.in_(line_ids))
        .where(OEERecord.date >= since)
        .where(OEERecord.date < until)
        .group_by(func.date(OEERecord.date))
        .order_by(func.date(OEERecord.date))
    )
    rows = result.all()

    return [
        {
            "date": str(r.day),
            "oee": round(r.avg_oee or 0, 2),
            "availability": round(r.avg_availability or 0, 2),
            "performance": round(r.avg_performance or 0, 2),
            "quality": round(r.avg_quality or 0, 2),
            "line_count": r.count,
        }
        for r in rows
    ]
