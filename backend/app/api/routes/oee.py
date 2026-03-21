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
from app.schemas.lean import OEEResponse, OEESummary, OEECalculateRequest, OEECalculateResponse
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
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    return await OEECalculator.get_line_summary(db, line_id, days)


@router.get("/trend/{line_id}")
async def get_oee_trend(
    line_id: int,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)
    return await OEECalculator.get_trend(db, line_id, days)


@router.post("/calculate", response_model=OEECalculateResponse)
async def calculate_oee_manual(
    data: OEECalculateRequest,
    user: User = Depends(get_current_user),
):
    """Quick OEE calculation without storing - useful for what-if scenarios."""
    return OEECalculator.calculate_oee(
        data.planned_time_min,
        data.run_time_min,
        data.total_pieces,
        data.good_pieces,
        data.ideal_cycle_time_sec,
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


@router.get("/losses/{line_id}")
async def get_six_big_losses(
    line_id: int,
    days: int = 30,
    start_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    end_date: Optional[str] = Query(None, description="ISO date yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Six Big Losses breakdown for a production line.

    Returns data suitable for a waterfall chart:
      1. Equipment Failure (breakdown downtime)
      2. Setup & Adjustment (changeover downtime)
      3. Idling & Minor Stops (minor_stop, material, quality, other downtime)
      4. Reduced Speed (performance gap vs ideal cycle time)
      5. Process Defects (scrap/QC rejects)
      6. Reduced Yield (startup rejects — first-hour scrap)
    """
    from sqlalchemy import and_
    from app.models.production import DowntimeEvent, ScrapRecord

    fid = require_factory(user)
    await _verify_line_ownership(db, line_id, fid)

    since, until = _parse_date_range(start_date, end_date, days)

    # --- OEE aggregates ---
    oee_q = select(
        func.sum(OEERecord.planned_time_min).label("total_planned"),
        func.sum(OEERecord.run_time_min).label("total_run"),
        func.sum(OEERecord.downtime_min).label("total_downtime"),
        func.sum(OEERecord.total_pieces).label("total_pieces"),
        func.sum(OEERecord.good_pieces).label("total_good"),
        func.avg(OEERecord.performance).label("avg_performance"),
    ).where(
        and_(
            OEERecord.production_line_id == line_id,
            OEERecord.date >= since,
            OEERecord.date < until,
        )
    )
    oee_result = await db.execute(oee_q)
    oee_row = oee_result.one_or_none()

    if not oee_row or not oee_row.total_planned:
        return {"losses": [], "total_available_min": 0, "summary": {}}

    total_planned = float(oee_row.total_planned or 0)
    total_run = float(oee_row.total_run or 0)
    total_pieces = int(oee_row.total_pieces or 0)
    good_pieces = int(oee_row.total_good or 0)
    avg_performance = float(oee_row.avg_performance or 100)

    # --- Downtime by category ---
    dt_q = select(
        DowntimeEvent.category,
        func.sum(DowntimeEvent.duration_minutes).label("total_min"),
    ).where(
        and_(
            DowntimeEvent.production_line_id == line_id,
            DowntimeEvent.start_time >= since,
            DowntimeEvent.start_time < until,
        )
    ).group_by(DowntimeEvent.category)
    dt_result = await db.execute(dt_q)
    dt_by_cat = {r.category: float(r.total_min or 0) for r in dt_result.all() if r.category}

    # --- Scrap totals ---
    scrap_q = select(
        func.sum(ScrapRecord.quantity).label("total_scrap"),
    ).where(
        and_(
            ScrapRecord.production_line_id == line_id,
            ScrapRecord.date >= since,
            ScrapRecord.date < until,
        )
    )
    scrap_result = await db.execute(scrap_q)
    scrap_row = scrap_result.one_or_none()
    total_scrap = int(scrap_row.total_scrap or 0) if scrap_row else 0

    # --- Calculate Six Big Losses ---
    # 1. Equipment Failure: unplanned + maintenance breakdowns
    equipment_failure_min = dt_by_cat.get("unplanned", 0) + dt_by_cat.get("maintenance", 0)

    # 2. Setup & Adjustment: changeover time
    setup_adjustment_min = dt_by_cat.get("changeover", 0)

    # 3. Idling & Minor Stops: everything else (material, quality, other, planned)
    categorized = equipment_failure_min + setup_adjustment_min
    total_downtime_from_events = sum(dt_by_cat.values())
    idling_minor_stops_min = max(0, total_downtime_from_events - categorized)

    # 4. Reduced Speed: gap between ideal and actual throughput during run time
    perf_pct = avg_performance / 100
    reduced_speed_min = total_run * (1 - perf_pct) if perf_pct < 1 else 0

    # 5. Process Defects: scrap pieces (convert to time equivalent using run rate)
    pieces_per_min = total_pieces / total_run if total_run > 0 else 1
    process_defects_min = total_scrap / pieces_per_min if pieces_per_min > 0 else 0

    # 6. Reduced Yield: startup rejects (estimate as difference between total defects and scrap)
    total_reject_pieces = total_pieces - good_pieces
    startup_rejects = max(0, total_reject_pieces - total_scrap)
    reduced_yield_min = startup_rejects / pieces_per_min if pieces_per_min > 0 else 0

    losses = [
        {
            "category": "Equipment Failure",
            "loss_type": "availability",
            "minutes_lost": round(equipment_failure_min, 1),
            "pct_of_total": round(equipment_failure_min / total_planned * 100, 2) if total_planned else 0,
        },
        {
            "category": "Setup & Adjustment",
            "loss_type": "availability",
            "minutes_lost": round(setup_adjustment_min, 1),
            "pct_of_total": round(setup_adjustment_min / total_planned * 100, 2) if total_planned else 0,
        },
        {
            "category": "Idling & Minor Stops",
            "loss_type": "performance",
            "minutes_lost": round(idling_minor_stops_min, 1),
            "pct_of_total": round(idling_minor_stops_min / total_planned * 100, 2) if total_planned else 0,
        },
        {
            "category": "Reduced Speed",
            "loss_type": "performance",
            "minutes_lost": round(reduced_speed_min, 1),
            "pct_of_total": round(reduced_speed_min / total_planned * 100, 2) if total_planned else 0,
        },
        {
            "category": "Process Defects",
            "loss_type": "quality",
            "minutes_lost": round(process_defects_min, 1),
            "pct_of_total": round(process_defects_min / total_planned * 100, 2) if total_planned else 0,
        },
        {
            "category": "Reduced Yield",
            "loss_type": "quality",
            "minutes_lost": round(reduced_yield_min, 1),
            "pct_of_total": round(reduced_yield_min / total_planned * 100, 2) if total_planned else 0,
        },
    ]

    total_losses = sum(l["minutes_lost"] for l in losses)
    effective_output_min = max(0, total_planned - total_losses)

    return {
        "losses": losses,
        "total_available_min": round(total_planned, 1),
        "total_losses_min": round(total_losses, 1),
        "effective_output_min": round(effective_output_min, 1),
        "summary": {
            "availability_losses_min": round(equipment_failure_min + setup_adjustment_min, 1),
            "performance_losses_min": round(idling_minor_stops_min + reduced_speed_min, 1),
            "quality_losses_min": round(process_defects_min + reduced_yield_min, 1),
            "total_pieces": total_pieces,
            "good_pieces": good_pieces,
            "scrap_pieces": total_scrap,
        },
        "downtime_by_category": dt_by_cat,
    }


@router.get("/alerts/{line_id}")
async def get_oee_alerts(
    line_id: int,
    threshold_pct: float = 10.0,
    oee_threshold: float = 75.0,
    min_consecutive: int = 3,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect OEE drops >threshold% compared to 7-day average, plus consecutive below-threshold alerts."""
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

    # Check consecutive records below threshold
    recent_q = (
        select(OEERecord.oee, OEERecord.date)
        .where(OEERecord.production_line_id == line_id)
        .order_by(OEERecord.date.desc())
        .limit(max(min_consecutive + 2, 10))
    )
    recent_r = await db.execute(recent_q)
    recent_records = recent_r.all()

    consecutive_below = 0
    for rec in recent_records:
        if rec.oee < oee_threshold:
            consecutive_below += 1
        else:
            break

    if consecutive_below >= min_consecutive:
        current_oee = recent_records[0].oee if recent_records else 0
        severity_level = "critical" if current_oee < 60 else "major"
        alerts.append({
            "type": "oee_below_threshold",
            "severity": severity_level,
            "message": f"OEE below {oee_threshold}% for {consecutive_below} consecutive records",
            "current_oee": round(current_oee, 1),
            "threshold": oee_threshold,
            "consecutive_count": consecutive_below,
            "suggest_ncr": True,
        })

    return {"alerts": alerts}


from pydantic import BaseModel as PydanticBaseModel


class OEETriggerNCRRequest(PydanticBaseModel):
    production_line_id: int
    oee_value: float
    threshold: float = 75.0
    consecutive_days: int = 3


@router.post("/trigger-ncr")
async def trigger_ncr_from_oee(
    data: OEETriggerNCRRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create an NCR when OEE is below threshold for consecutive days."""
    from app.services.qc_service import NCRService

    fid = require_factory(user)
    await _verify_line_ownership(db, data.production_line_id, fid)

    severity = "major" if data.oee_value < 60 else "minor"
    title = f"OEE Below Threshold: {data.oee_value:.1f}% for {data.consecutive_days} days"
    description = (
        f"OEE has been below the {data.threshold}% threshold for {data.consecutive_days} "
        f"consecutive records on production line {data.production_line_id}. "
        f"Current OEE: {data.oee_value:.1f}%. Investigation required."
    )

    ncr = await NCRService.create(db, fid, user.id, {
        "production_line_id": data.production_line_id,
        "title": title,
        "description": description,
        "severity": severity,
    })

    return {
        "ncr_id": ncr.id,
        "ncr_number": ncr.ncr_number,
        "severity": severity,
        "title": title,
    }
