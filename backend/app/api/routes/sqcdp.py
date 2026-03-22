"""SQCDP Board & Tier Meetings — Daily visual management."""
import logging
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user, require_factory, require_role
from app.models.sqcdp import SQCDPEntry, SQCDPMeeting
from app.schemas.sqcdp import (
    SQCDPEntryCreate, SQCDPEntryUpdate, SQCDPEntryResponse,
    SQCDPMeetingCreate, SQCDPMeetingResponse, SQCDPBoardResponse,
)
from app.services.notification_service import notify_factory_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sqcdp", tags=["SQCDP"])


@router.post("/entries", response_model=SQCDPEntryResponse)
async def create_entry(
    data: SQCDPEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fid = require_factory(current_user)
    entry = SQCDPEntry(
        factory_id=fid,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    # Auto-escalation: T1 RED entries that have been RED for >48h → escalate to T2
    if data.tier_level == 1 and data.status == "red":
        await _check_auto_escalation(db, fid, entry)

    return entry


@router.get("/entries", response_model=list[SQCDPEntryResponse])
async def list_entries(
    target_date: date = Query(None),
    line_id: int = Query(None),
    tier_level: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SQCDPEntry).where(SQCDPEntry.factory_id == require_factory(current_user))
    if target_date:
        q = q.where(SQCDPEntry.date == target_date)
    if line_id:
        q = q.where(SQCDPEntry.production_line_id == line_id)
    if tier_level:
        q = q.where(SQCDPEntry.tier_level == tier_level)
    q = q.order_by(SQCDPEntry.date.desc(), SQCDPEntry.category).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/board", response_model=SQCDPBoardResponse)
async def get_board(
    target_date: date = Query(None),
    line_id: int = Query(None),
    tier_level: int = Query(1),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    d = target_date or date.today()
    q = select(SQCDPEntry).where(
        and_(
            SQCDPEntry.factory_id == require_factory(current_user),
            SQCDPEntry.date == d,
            SQCDPEntry.tier_level == tier_level,
        )
    )
    if line_id:
        q = q.where(SQCDPEntry.production_line_id == line_id)
    result = await db.execute(q)
    entries = result.scalars().all()
    by_cat = {e.category: e for e in entries}
    return SQCDPBoardResponse(
        date=d,
        entries=entries,
        safety=by_cat.get("safety"),
        quality=by_cat.get("quality"),
        cost=by_cat.get("cost"),
        delivery=by_cat.get("delivery"),
        people=by_cat.get("people"),
    )


@router.patch("/entries/{entry_id}", response_model=SQCDPEntryResponse)
async def update_entry(
    entry_id: int,
    data: SQCDPEntryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fid = require_factory(current_user)
    result = await db.execute(
        select(SQCDPEntry).where(
            SQCDPEntry.id == entry_id,
            SQCDPEntry.factory_id == fid,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)

    # Auto-escalation: T1 RED entries that have been RED for >48h → escalate to T2
    if entry.tier_level == 1 and entry.status == "red":
        await _check_auto_escalation(db, fid, entry)

    return entry


@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("line_supervisor")),
):
    result = await db.execute(
        select(SQCDPEntry).where(
            SQCDPEntry.id == entry_id,
            SQCDPEntry.factory_id == require_factory(current_user),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"ok": True}


# --- Meetings ---

@router.post("/meetings", response_model=SQCDPMeetingResponse)
async def create_meeting(
    data: SQCDPMeetingCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    meeting = SQCDPMeeting(
        factory_id=require_factory(current_user),
        led_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)
    return meeting


@router.get("/meetings", response_model=list[SQCDPMeetingResponse])
async def list_meetings(
    tier_level: int = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SQCDPMeeting).where(SQCDPMeeting.factory_id == require_factory(current_user))
    if tier_level:
        q = q.where(SQCDPMeeting.tier_level == tier_level)
    q = q.order_by(SQCDPMeeting.date.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


# ─── Auto-Escalation Helper ─────────────────────────────────────────────────


async def _check_auto_escalation(
    db: AsyncSession,
    factory_id: int,
    entry: SQCDPEntry,
) -> None:
    """
    Check if a RED T1 entry should be auto-escalated to T2.
    If the same category+line has been RED for >48 hours (based on created_at),
    notify T2 managers.
    """
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
        # Check if this entry was created more than 48h ago and is still RED
        if entry.created_at.replace(tzinfo=timezone.utc) <= cutoff:
            await notify_factory_role(
                db,
                factory_id=factory_id,
                role="manager",
                notification_type="escalation",
                title=f"SQCDP Auto-Escalation: {entry.category.upper()} RED >48h",
                message=(
                    f"SQCDP {entry.category} has been RED for over 48 hours "
                    f"(since {entry.date}). Auto-escalated from T1 to T2."
                ),
                priority="high",
                link="/operations/sqcdp",
                source_type="sqcdp_entry",
                source_id=entry.id,
            )
            await db.commit()
    except Exception as e:
        logger.error(f"SQCDP escalation notification failed: {e}")


# ─── Auto-Populate from Live Data ──────────────────────────────────────────


@router.post("/auto-populate", response_model=SQCDPBoardResponse)
async def auto_populate_board(
    target_date: date = Query(None),
    line_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Auto-populate SQCDP board from real Safety, Quality, OEE, Production data."""
    from sqlalchemy import func
    from app.models.safety import SafetyIncident
    from app.models.lean import OEERecord
    from app.models.production import ProductionRecord, ScrapRecord
    from app.models.qc import NonConformanceReport

    fid = require_factory(current_user)
    d = target_date or date.today()

    created = []

    async def _upsert(category: str, status: str, metric: float | None, target: float | None, comment: str):
        """Create or update SQCDP entry for the given category."""
        q = select(SQCDPEntry).where(and_(
            SQCDPEntry.factory_id == fid,
            SQCDPEntry.date == d,
            SQCDPEntry.category == category,
            SQCDPEntry.tier_level == 1,
        ))
        if line_id:
            q = q.where(SQCDPEntry.production_line_id == line_id)
        result = await db.execute(q)
        existing = result.scalar_one_or_none()
        if existing:
            existing.status = status
            existing.metric_value = metric
            existing.target_value = target
            existing.comment = comment
            created.append(existing)
        else:
            entry = SQCDPEntry(
                factory_id=fid,
                production_line_id=line_id,
                created_by_id=current_user.id,
                date=d,
                category=category,
                status=status,
                metric_value=metric,
                target_value=target,
                comment=comment,
                tier_level=1,
            )
            db.add(entry)
            created.append(entry)

    # SAFETY: count incidents today
    try:
        safety_q = select(func.count()).select_from(SafetyIncident).where(and_(
            SafetyIncident.factory_id == fid,
            func.date(SafetyIncident.date) == d,
        ))
        incident_count = (await db.execute(safety_q)).scalar() or 0
        s_status = "red" if incident_count > 0 else "green"
        await _upsert("safety", s_status, float(incident_count), 0.0, f"{incident_count} incident(s) today")
    except Exception as e:
        logger.error(f"SQCDP auto-populate safety failed: {e}")

    # QUALITY: scrap rate today
    try:
        prod_q = select(
            func.sum(ProductionRecord.total_pieces).label("total"),
            func.sum(ProductionRecord.good_pieces).label("good"),
        ).where(and_(
            func.date(ProductionRecord.date) == d,
        ))
        if line_id:
            prod_q = prod_q.where(ProductionRecord.production_line_id == line_id)
        pr = (await db.execute(prod_q)).one_or_none()
        total = pr.total or 0 if pr else 0
        good = pr.good or 0 if pr else 0
        scrap_pct = ((total - good) / total * 100) if total > 0 else 0.0
        q_status = "green" if scrap_pct < 2 else ("amber" if scrap_pct < 5 else "red")
        await _upsert("quality", q_status, round(scrap_pct, 1), 2.0, f"Scrap rate: {scrap_pct:.1f}%")
    except Exception as e:
        logger.error(f"SQCDP auto-populate quality failed: {e}")

    # COST: OEE (cost of lost production)
    try:
        oee_q = select(func.avg(OEERecord.oee)).where(and_(
            func.date(OEERecord.date) == d,
        ))
        if line_id:
            oee_q = oee_q.where(OEERecord.production_line_id == line_id)
        avg_oee = (await db.execute(oee_q)).scalar() or 0.0
        c_status = "green" if avg_oee >= 85 else ("amber" if avg_oee >= 65 else "red")
        await _upsert("cost", c_status, round(avg_oee, 1), 85.0, f"OEE: {avg_oee:.1f}%")
    except Exception as e:
        logger.error(f"SQCDP auto-populate cost failed: {e}")

    # DELIVERY: actual vs planned
    try:
        total_actual = total if total else 0
        # Use simple target for now
        d_status = "green" if total_actual > 0 else "amber"
        await _upsert("delivery", d_status, float(total_actual), None, f"Output: {total_actual} pcs")
    except Exception as e:
        logger.error(f"SQCDP auto-populate delivery failed: {e}")

    # PEOPLE: default green (no auto source yet)
    try:
        await _upsert("people", "green", None, None, "No issues reported")
    except Exception as e:
        logger.error(f"SQCDP auto-populate people failed: {e}")

    await db.commit()
    for entry in created:
        await db.refresh(entry)

    by_cat = {e.category: e for e in created}
    return SQCDPBoardResponse(
        date=d,
        entries=created,
        safety=by_cat.get("safety"),
        quality=by_cat.get("quality"),
        cost=by_cat.get("cost"),
        delivery=by_cat.get("delivery"),
        people=by_cat.get("people"),
    )
