"""
Report-data endpoints — return structured JSON for frontend PDF rendering.

Each endpoint aggregates factory data over a date range and returns
a report-ready payload (summaries, trend arrays, top-N breakdowns).
All queries enforce tenant isolation via factory_id.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.factory import ProductionLine
from app.models.lean import KaizenItem, OEERecord
from app.models.production import DowntimeEvent
from app.models.qc import NonConformanceReport, QCCheckResultRecord, QCRecord
from app.models.sqcdp import SQCDPEntry, SQCDPMeeting

router = APIRouter(prefix="/reports", tags=["reports"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _month_range(year: int, month: int) -> tuple[datetime, datetime]:
    """Return (start_utc, end_utc) for a calendar month."""
    if not (1 <= month <= 12):
        raise HTTPException(status_code=422, detail="month must be 1-12")
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=422, detail="year out of range")
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    since = datetime(first_day.year, first_day.month, first_day.day, tzinfo=timezone.utc)
    until = datetime(last_day.year, last_day.month, last_day.day, 23, 59, 59, tzinfo=timezone.utc)
    return since, until


def _parse_dates(start_date: str, end_date: str) -> tuple[datetime, datetime]:
    """Parse ISO date strings into a UTC datetime range (inclusive)."""
    try:
        since = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
        until = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc) + timedelta(days=1)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=422,
            detail="Invalid date format. Use ISO format yyyy-mm-dd.",
        )
    return since, until


async def _factory_line_ids(db: AsyncSession, factory_id: int) -> list[int]:
    """Return all production line IDs belonging to a factory."""
    result = await db.execute(
        select(ProductionLine.id).where(ProductionLine.factory_id == factory_id)
    )
    return [r[0] for r in result.all()]


# ---------------------------------------------------------------------------
# 1. OEE Monthly Report
# ---------------------------------------------------------------------------

@router.get("/oee-monthly")
async def oee_monthly_report(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100),
    line_id: Optional[int] = Query(None, description="Filter to a single production line"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Monthly OEE summary report — per-line averages, daily trend, top downtime reasons."""
    fid = require_factory(user)
    since, until = _month_range(year, month)

    # Resolve lines
    if line_id:
        # Verify ownership
        ln = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == line_id,
                ProductionLine.factory_id == fid,
            )
        )
        if not ln.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")
        line_ids = [line_id]
    else:
        line_ids = await _factory_line_ids(db, fid)

    if not line_ids:
        return {
            "month": month, "year": year,
            "per_line": [], "daily_trend": [],
            "top_downtime_reasons": [], "summary": {},
        }

    # ---- Per-line averages ----
    lines_q = await db.execute(
        select(ProductionLine).where(ProductionLine.id.in_(line_ids))
    )
    lines = {l.id: l.name for l in lines_q.scalars().all()}

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
        .where(OEERecord.date >= since, OEERecord.date <= until)
        .group_by(OEERecord.production_line_id)
    )

    per_line = []
    for row in per_line_result.all():
        per_line.append({
            "line_id": row.production_line_id,
            "line_name": lines.get(row.production_line_id, "Unknown"),
            "avg_oee": round(float(row.avg_oee or 0), 2),
            "avg_availability": round(float(row.avg_availability or 0), 2),
            "avg_performance": round(float(row.avg_performance or 0), 2),
            "avg_quality": round(float(row.avg_quality or 0), 2),
            "record_count": row.record_count,
            "total_downtime_min": round(float(row.total_downtime or 0), 1),
        })

    # ---- Daily trend (factory-wide) ----
    daily_result = await db.execute(
        select(
            func.date(OEERecord.date).label("day"),
            func.avg(OEERecord.oee).label("avg_oee"),
            func.avg(OEERecord.availability).label("avg_availability"),
            func.avg(OEERecord.performance).label("avg_performance"),
            func.avg(OEERecord.quality).label("avg_quality"),
        )
        .where(OEERecord.production_line_id.in_(line_ids))
        .where(OEERecord.date >= since, OEERecord.date <= until)
        .group_by(func.date(OEERecord.date))
        .order_by(func.date(OEERecord.date))
    )
    daily_trend = [
        {
            "date": str(r.day),
            "oee": round(float(r.avg_oee or 0), 2),
            "availability": round(float(r.avg_availability or 0), 2),
            "performance": round(float(r.avg_performance or 0), 2),
            "quality": round(float(r.avg_quality or 0), 2),
        }
        for r in daily_result.all()
    ]

    # ---- Top downtime reasons ----
    dt_result = await db.execute(
        select(
            DowntimeEvent.reason,
            DowntimeEvent.category,
            func.sum(DowntimeEvent.duration_minutes).label("total_min"),
            func.count(DowntimeEvent.id).label("occurrences"),
        )
        .where(
            DowntimeEvent.production_line_id.in_(line_ids),
            DowntimeEvent.start_time >= since,
            DowntimeEvent.start_time <= until,
        )
        .group_by(DowntimeEvent.reason, DowntimeEvent.category)
        .order_by(func.sum(DowntimeEvent.duration_minutes).desc())
        .limit(10)
    )
    top_downtime = [
        {
            "reason": r.reason,
            "category": r.category,
            "total_minutes": round(float(r.total_min or 0), 1),
            "occurrences": r.occurrences,
        }
        for r in dt_result.all()
    ]

    # ---- Factory-wide summary ----
    summary_result = await db.execute(
        select(
            func.avg(OEERecord.oee).label("avg_oee"),
            func.avg(OEERecord.availability).label("avg_availability"),
            func.avg(OEERecord.performance).label("avg_performance"),
            func.avg(OEERecord.quality).label("avg_quality"),
            func.count(OEERecord.id).label("record_count"),
            func.sum(OEERecord.downtime_min).label("total_downtime"),
        )
        .where(OEERecord.production_line_id.in_(line_ids))
        .where(OEERecord.date >= since, OEERecord.date <= until)
    )
    srow = summary_result.one()

    return {
        "month": month,
        "year": year,
        "per_line": per_line,
        "daily_trend": daily_trend,
        "top_downtime_reasons": top_downtime,
        "summary": {
            "avg_oee": round(float(srow.avg_oee or 0), 2),
            "avg_availability": round(float(srow.avg_availability or 0), 2),
            "avg_performance": round(float(srow.avg_performance or 0), 2),
            "avg_quality": round(float(srow.avg_quality or 0), 2),
            "record_count": srow.record_count or 0,
            "total_downtime_min": round(float(srow.total_downtime or 0), 1),
        },
    }


# ---------------------------------------------------------------------------
# 2. QC Summary Report
# ---------------------------------------------------------------------------

@router.get("/qc-summary")
async def qc_summary_report(
    start_date: str = Query(..., description="ISO date yyyy-mm-dd"),
    end_date: str = Query(..., description="ISO date yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """QC summary — inspections, pass/fail rates, top defects, NCR count."""
    fid = require_factory(user)
    since, until = _parse_dates(start_date, end_date)

    # ---- Inspection counts by status ----
    status_result = await db.execute(
        select(
            QCRecord.status,
            func.count(QCRecord.id).label("cnt"),
        )
        .where(
            QCRecord.factory_id == fid,
            QCRecord.started_at >= since,
            QCRecord.started_at < until,
        )
        .group_by(QCRecord.status)
    )
    status_counts: dict[str, int] = {}
    total_inspections = 0
    for row in status_result.all():
        status_counts[row.status] = row.cnt
        total_inspections += row.cnt

    passed = status_counts.get("passed", 0) + status_counts.get("passed_with_deviations", 0)
    failed = status_counts.get("failed", 0)
    pass_rate = round(passed / total_inspections * 100, 1) if total_inspections else 0
    fail_rate = round(failed / total_inspections * 100, 1) if total_inspections else 0

    # ---- Average score ----
    avg_score_result = await db.execute(
        select(func.avg(QCRecord.overall_score_pct)).where(
            QCRecord.factory_id == fid,
            QCRecord.started_at >= since,
            QCRecord.started_at < until,
            QCRecord.overall_score_pct.isnot(None),
        )
    )
    avg_score = avg_score_result.scalar()

    # ---- Top defect types (from check results linked to QC records in this factory) ----
    from app.models.qc import DefectCatalog

    defect_result = await db.execute(
        select(
            DefectCatalog.name,
            DefectCatalog.category,
            func.count(QCCheckResultRecord.id).label("cnt"),
        )
        .join(QCRecord, QCCheckResultRecord.qc_record_id == QCRecord.id)
        .join(DefectCatalog, QCCheckResultRecord.defect_catalog_id == DefectCatalog.id)
        .where(
            QCRecord.factory_id == fid,
            QCRecord.started_at >= since,
            QCRecord.started_at < until,
            QCCheckResultRecord.result == "fail",
        )
        .group_by(DefectCatalog.name, DefectCatalog.category)
        .order_by(func.count(QCCheckResultRecord.id).desc())
        .limit(10)
    )
    top_defects = [
        {"name": r.name, "category": r.category, "count": r.cnt}
        for r in defect_result.all()
    ]

    # ---- NCR count ----
    ncr_result = await db.execute(
        select(
            NonConformanceReport.status,
            func.count(NonConformanceReport.id).label("cnt"),
        )
        .where(
            NonConformanceReport.factory_id == fid,
            NonConformanceReport.detected_at >= since,
            NonConformanceReport.detected_at < until,
        )
        .group_by(NonConformanceReport.status)
    )
    ncr_by_status: dict[str, int] = {}
    ncr_total = 0
    for row in ncr_result.all():
        ncr_by_status[row.status] = row.cnt
        ncr_total += row.cnt

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_inspections": total_inspections,
        "status_breakdown": status_counts,
        "pass_rate_pct": pass_rate,
        "fail_rate_pct": fail_rate,
        "avg_score_pct": round(float(avg_score or 0), 1),
        "top_defect_types": top_defects,
        "ncr_total": ncr_total,
        "ncr_by_status": ncr_by_status,
    }


# ---------------------------------------------------------------------------
# 3. Kaizen Savings / Impact Report
# ---------------------------------------------------------------------------

@router.get("/kaizen-savings")
async def kaizen_savings_report(
    start_date: str = Query(..., description="ISO date yyyy-mm-dd"),
    end_date: str = Query(..., description="ISO date yyyy-mm-dd"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kaizen impact — completed count, savings, before/after, top contributors."""
    fid = require_factory(user)
    since, until = _parse_dates(start_date, end_date)

    # ---- Counts by status ----
    status_result = await db.execute(
        select(
            KaizenItem.status,
            func.count(KaizenItem.id).label("cnt"),
        )
        .where(
            KaizenItem.factory_id == fid,
            KaizenItem.created_at >= since,
            KaizenItem.created_at < until,
        )
        .group_by(KaizenItem.status)
    )
    status_counts: dict[str, int] = {}
    total = 0
    for row in status_result.all():
        status_counts[row.status] = row.cnt
        total += row.cnt

    # ---- Completed kaizens with savings (those completed in the period) ----
    completed_result = await db.execute(
        select(
            func.count(KaizenItem.id).label("completed_count"),
            func.sum(KaizenItem.actual_savings_eur).label("total_actual_savings"),
            func.sum(KaizenItem.expected_savings_eur).label("total_expected_savings"),
            func.avg(KaizenItem.actual_savings_eur).label("avg_savings"),
        )
        .where(
            KaizenItem.factory_id == fid,
            KaizenItem.completion_date >= since,
            KaizenItem.completion_date < until,
            KaizenItem.status == "completed",
        )
    )
    crow = completed_result.one()

    # ---- Savings by category ----
    category_result = await db.execute(
        select(
            KaizenItem.category,
            func.count(KaizenItem.id).label("cnt"),
            func.sum(KaizenItem.actual_savings_eur).label("savings"),
        )
        .where(
            KaizenItem.factory_id == fid,
            KaizenItem.completion_date >= since,
            KaizenItem.completion_date < until,
            KaizenItem.status == "completed",
        )
        .group_by(KaizenItem.category)
        .order_by(func.sum(KaizenItem.actual_savings_eur).desc())
    )
    by_category = [
        {
            "category": r.category or "uncategorized",
            "count": r.cnt,
            "total_savings_eur": round(float(r.savings or 0), 2),
        }
        for r in category_result.all()
    ]

    # ---- Top contributors (by count of completed kaizens) ----
    contributor_result = await db.execute(
        select(
            User.full_name,
            User.email,
            func.count(KaizenItem.id).label("cnt"),
            func.sum(KaizenItem.actual_savings_eur).label("savings"),
        )
        .join(User, KaizenItem.created_by_id == User.id)
        .where(
            KaizenItem.factory_id == fid,
            KaizenItem.completion_date >= since,
            KaizenItem.completion_date < until,
            KaizenItem.status == "completed",
        )
        .group_by(User.full_name, User.email)
        .order_by(func.count(KaizenItem.id).desc())
        .limit(10)
    )
    top_contributors = [
        {
            "name": r.full_name or r.email,
            "completed_count": r.cnt,
            "total_savings_eur": round(float(r.savings or 0), 2),
        }
        for r in contributor_result.all()
    ]

    # ---- Before/after: expected vs actual savings (for completed items with both) ----
    before_after_result = await db.execute(
        select(
            KaizenItem.title,
            KaizenItem.category,
            KaizenItem.expected_savings_eur,
            KaizenItem.actual_savings_eur,
        )
        .where(
            KaizenItem.factory_id == fid,
            KaizenItem.completion_date >= since,
            KaizenItem.completion_date < until,
            KaizenItem.status == "completed",
            KaizenItem.expected_savings_eur.isnot(None),
            KaizenItem.actual_savings_eur.isnot(None),
        )
        .order_by(KaizenItem.actual_savings_eur.desc())
        .limit(15)
    )
    before_after = [
        {
            "title": r.title,
            "category": r.category,
            "expected_savings_eur": round(float(r.expected_savings_eur or 0), 2),
            "actual_savings_eur": round(float(r.actual_savings_eur or 0), 2),
        }
        for r in before_after_result.all()
    ]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_kaizens": total,
        "status_breakdown": status_counts,
        "completed_count": crow.completed_count or 0,
        "total_actual_savings_eur": round(float(crow.total_actual_savings or 0), 2),
        "total_expected_savings_eur": round(float(crow.total_expected_savings or 0), 2),
        "avg_savings_eur": round(float(crow.avg_savings or 0), 2),
        "by_category": by_category,
        "top_contributors": top_contributors,
        "before_after_metrics": before_after,
    }


# ---------------------------------------------------------------------------
# 4. SQCDP Monthly Summary
# ---------------------------------------------------------------------------

@router.get("/sqcdp-summary")
async def sqcdp_summary_report(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """SQCDP monthly summary — per-category status counts, meetings, action completion."""
    fid = require_factory(user)
    since, until = _month_range(year, month)
    since_date = since.date()
    until_date = until.date()

    # ---- Per-category daily status counts ----
    cat_result = await db.execute(
        select(
            SQCDPEntry.category,
            SQCDPEntry.status,
            func.count(SQCDPEntry.id).label("cnt"),
        )
        .where(
            SQCDPEntry.factory_id == fid,
            SQCDPEntry.date >= since_date,
            SQCDPEntry.date <= until_date,
        )
        .group_by(SQCDPEntry.category, SQCDPEntry.status)
    )
    # Build {category: {green: N, amber: N, red: N}}
    per_category: dict[str, dict[str, int]] = {}
    for row in cat_result.all():
        cat = row.category
        if cat not in per_category:
            per_category[cat] = {"green": 0, "amber": 0, "red": 0, "total": 0}
        per_category[cat][row.status] = per_category[cat].get(row.status, 0) + row.cnt
        per_category[cat]["total"] += row.cnt

    # ---- Daily trend (entries per day with red/amber/green counts) ----
    daily_result = await db.execute(
        select(
            SQCDPEntry.date,
            func.sum(case((SQCDPEntry.status == "green", 1), else_=0)).label("green"),
            func.sum(case((SQCDPEntry.status == "amber", 1), else_=0)).label("amber"),
            func.sum(case((SQCDPEntry.status == "red", 1), else_=0)).label("red"),
            func.count(SQCDPEntry.id).label("total"),
        )
        .where(
            SQCDPEntry.factory_id == fid,
            SQCDPEntry.date >= since_date,
            SQCDPEntry.date <= until_date,
        )
        .group_by(SQCDPEntry.date)
        .order_by(SQCDPEntry.date)
    )
    daily_trend = [
        {
            "date": str(r.date),
            "green": int(r.green),
            "amber": int(r.amber),
            "red": int(r.red),
            "total": int(r.total),
        }
        for r in daily_result.all()
    ]

    # ---- Action items requiring action ----
    actions_result = await db.execute(
        select(
            func.count(SQCDPEntry.id).label("total_actions"),
            func.sum(
                case((SQCDPEntry.action_required == True, 1), else_=0)  # noqa: E712
            ).label("action_required_count"),
        )
        .where(
            SQCDPEntry.factory_id == fid,
            SQCDPEntry.date >= since_date,
            SQCDPEntry.date <= until_date,
        )
    )
    arow = actions_result.one()

    # ---- Meetings ----
    meeting_result = await db.execute(
        select(
            func.count(SQCDPMeeting.id).label("meeting_count"),
            func.avg(SQCDPMeeting.duration_min).label("avg_duration"),
            func.avg(SQCDPMeeting.attendee_count).label("avg_attendees"),
        )
        .where(
            SQCDPMeeting.factory_id == fid,
            SQCDPMeeting.date >= since_date,
            SQCDPMeeting.date <= until_date,
        )
    )
    mrow = meeting_result.one()

    # ---- Action item completion from meeting action_items JSON ----
    # action_items is JSON: [{description, owner, due_date, status}, ...]
    # We fetch all meetings and compute in-memory since JSON aggregation is DB-dependent
    meetings_with_actions = await db.execute(
        select(SQCDPMeeting.action_items).where(
            SQCDPMeeting.factory_id == fid,
            SQCDPMeeting.date >= since_date,
            SQCDPMeeting.date <= until_date,
            SQCDPMeeting.action_items.isnot(None),
        )
    )
    total_action_items = 0
    completed_action_items = 0
    for (items,) in meetings_with_actions.all():
        if isinstance(items, list):
            for item in items:
                total_action_items += 1
                if isinstance(item, dict) and item.get("status") in ("done", "completed", "closed"):
                    completed_action_items += 1

    action_completion_rate = (
        round(completed_action_items / total_action_items * 100, 1)
        if total_action_items else 0
    )

    return {
        "month": month,
        "year": year,
        "per_category": per_category,
        "daily_trend": daily_trend,
        "entries_total": int(arow.total_actions or 0),
        "action_required_count": int(arow.action_required_count or 0),
        "meetings": {
            "count": mrow.meeting_count or 0,
            "avg_duration_min": round(float(mrow.avg_duration or 0), 1),
            "avg_attendees": round(float(mrow.avg_attendees or 0), 1),
        },
        "action_items": {
            "total": total_action_items,
            "completed": completed_action_items,
            "completion_rate_pct": action_completion_rate,
        },
    }
