from fastapi import APIRouter, Depends, HTTPException, Query
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


def _parse_date_range(start_date: Optional[str], end_date: Optional[str], days: int):
    """Parse ISO date strings into a (since, until) UTC datetime range.

    Falls back to ``days`` offset from now when dates are not provided.
    Raises HTTPException 422 on malformed dates.
    """
    if start_date and end_date:
        try:
            since = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            until = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=422,
                detail="Invalid date format. Use ISO format yyyy-mm-dd.",
            )
    else:
        until = datetime.now(timezone.utc)
        since = until - timedelta(days=days)
    return since, until


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
    since, until = _parse_date_range(start_date, end_date, days)

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

    # Per-line summaries — single grouped query instead of N+1
    line_name_map = {l.id: l.name for l in lines}
    per_line_result = await db.execute(
        select(
            OEERecord.production_line_id,
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
        .group_by(OEERecord.production_line_id)
    )
    per_line_rows = per_line_result.all()

    # Build lookup of lines with data
    per_line_data = {row.production_line_id: row for row in per_line_rows}

    per_line = []
    for line in lines:
        row = per_line_data.get(line.id)
        per_line.append({
            "line_id": line.id,
            "line_name": line.name,
            "avg_oee": round(row.avg_oee or 0, 2) if row else 0,
            "avg_availability": round(row.avg_availability or 0, 2) if row else 0,
            "avg_performance": round(row.avg_performance or 0, 2) if row else 0,
            "avg_quality": round(row.avg_quality or 0, 2) if row else 0,
            "record_count": row.record_count or 0 if row else 0,
            "total_downtime_min": round(row.total_downtime or 0, 2) if row else 0,
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

    since, until = _parse_date_range(start_date, end_date, days)

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


# ──────────────────────────────────────────────────────────────────────────────
# Loss Waterfall & Alerts
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/loss-waterfall/{line_id}")
async def get_loss_waterfall(
    line_id: int,
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Loss waterfall breakdown: planned time -> availability losses -> performance losses -> quality losses -> OEE."""
    from sqlalchemy import and_
    from app.models.production import DowntimeEvent

    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Get average OEE components
    q = select(
        func.avg(OEERecord.availability).label("avg_availability"),
        func.avg(OEERecord.performance).label("avg_performance"),
        func.avg(OEERecord.quality).label("avg_quality"),
        func.avg(OEERecord.oee).label("avg_oee"),
        func.sum(OEERecord.planned_time_min).label("total_planned"),
        func.sum(OEERecord.downtime_min).label("total_downtime"),
        func.sum(OEERecord.total_pieces).label("total_pieces"),
        func.sum(OEERecord.good_pieces).label("total_good"),
    ).where(
        and_(
            OEERecord.production_line_id == line_id,
            OEERecord.date >= since,
        )
    )
    result = await db.execute(q)
    row = result.one_or_none()

    if not row or not row.total_planned:
        return {"waterfall": [], "losses": {}}

    planned = float(row.total_planned or 0)
    downtime = float(row.total_downtime or 0)
    total = int(row.total_pieces or 0)
    good = int(row.total_good or 0)

    availability_loss = downtime
    run_time = planned - downtime
    # Performance loss = time lost due to slow cycles
    perf_pct = float(row.avg_performance or 100) / 100
    performance_loss = run_time * (1 - perf_pct) if perf_pct < 1 else 0
    # Quality loss
    quality_loss = (total - good) if total > 0 else 0

    # Get downtime by category
    dt_q = select(
        DowntimeEvent.category,
        func.sum(DowntimeEvent.duration_minutes).label("total_min"),
    ).where(
        and_(
            DowntimeEvent.production_line_id == line_id,
            DowntimeEvent.start_time >= since,
        )
    ).group_by(DowntimeEvent.category)
    dt_result = await db.execute(dt_q)
    dt_categories = {r.category: float(r.total_min) for r in dt_result.all() if r.category}

    return {
        "waterfall": [
            {"label": "Planned Time", "value": round(planned, 1), "type": "total"},
            {"label": "Availability Loss", "value": round(availability_loss, 1), "type": "loss"},
            {"label": "Performance Loss", "value": round(performance_loss, 1), "type": "loss"},
            {"label": "Quality Loss", "value": round(quality_loss), "type": "loss"},
            {"label": "Effective Output", "value": round(planned - availability_loss - performance_loss - quality_loss, 1), "type": "result"},
        ],
        "losses": {
            "availability": round(float(row.avg_availability or 0), 1),
            "performance": round(float(row.avg_performance or 0), 1),
            "quality": round(float(row.avg_quality or 0), 1),
            "oee": round(float(row.avg_oee or 0), 1),
        },
        "downtime_by_category": dt_categories,
    }


@router.get("/alerts/{line_id}")
async def get_oee_alerts(
    line_id: int,
    threshold_pct: float = 10.0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect OEE drops >threshold% compared to 7-day average."""
    from sqlalchemy import and_

    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    now = datetime.now(timezone.utc)

    # Get latest OEE
    latest_q = select(OEERecord).where(
        OEERecord.production_line_id == line_id,
    ).order_by(OEERecord.date.desc()).limit(1)
    latest_r = await db.execute(latest_q)
    latest = latest_r.scalar_one_or_none()

    # Get 7-day average
    avg_q = select(func.avg(OEERecord.oee)).where(
        and_(
            OEERecord.production_line_id == line_id,
            OEERecord.date >= now - timedelta(days=7),
        )
    )
    avg_r = await db.execute(avg_q)
    avg_oee = avg_r.scalar() or 0

    alerts = []
    if latest and avg_oee > 0:
        drop = avg_oee - latest.oee
        if drop > threshold_pct:
            alerts.append({
                "type": "oee_drop",
                "severity": "high" if drop > 20 else "medium",
                "message": f"OEE dropped {drop:.1f}% below 7-day average",
                "current_oee": round(latest.oee, 1),
                "average_oee": round(avg_oee, 1),
                "drop_pct": round(drop, 1),
                "date": str(latest.date),
                "suggest_root_cause": True,
            })

    return {"alerts": alerts}
