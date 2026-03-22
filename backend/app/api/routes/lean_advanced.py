from fastapi import APIRouter, Body, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from datetime import datetime, timezone
import os
import structlog

logger = structlog.get_logger(__name__)

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.schemas.lean_advanced import (
    SixSAuditCreate, SixSAuditResponse, VSMCreate, VSMResponse,
    A3ReportCreate, A3ReportResponse,
    GembaWalkCreate, GembaWalkResponse,
    TPMEquipmentCreate, TPMMaintenanceCreate,
    CILTStandardCreate, CILTExecutionCreate,
    AndonEventCreate, AndonResolve, HourlyProductionCreate,
)
from app.services.lean_advanced import (
    SixSService, VSMService, A3Service, GembaService,
    TPMService, CILTService, AndonService, HourlyProductionService,
    AuditScheduleService,
)

router = APIRouter(prefix="/lean-advanced", tags=["lean-advanced"])


# ---- 6S AUDIT ----

@router.post("/six-s")
async def create_six_s_audit(
    data: SixSAuditCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    audit = await SixSService.create_audit(db, fid, user.id, data.model_dump())

    # Auto-create Kaizen items for failed 6S audit items (score <= 2)
    try:
        from app.models.lean import KaizenItem
        from app.models.lean_advanced import SixSAuditItem
        failed_q = select(SixSAuditItem).where(
            SixSAuditItem.audit_id == audit.id,
            SixSAuditItem.score <= 2,
        )
        failed_items = (await db.execute(failed_q)).scalars().all()
        for item in failed_items:
            kaizen = KaizenItem(
                factory_id=fid,
                title=f"[6S] {item.pillar}: {item.finding or 'Low score'}",
                description=item.finding or f"6S audit scored {item.score}/5 in {item.pillar}",
                category="workplace",
                priority="medium" if item.score == 2 else "high",
                status="idea",
                created_by_id=user.id,
                source_type="six_s",
                source_id=audit.id,
            )
            db.add(kaizen)
        if failed_items:
            await db.commit()
    except Exception as e:
        import structlog
        structlog.get_logger().error("six_s_kaizen_failed", error=str(e))

    return {"id": audit.id, "overall_score": audit.overall_score, "maturity_level": audit.maturity_level}


@router.get("/six-s", response_model=list[SixSAuditResponse])
async def list_six_s_audits(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SixSService.list_audits(db, fid, skip=skip, limit=limit)


@router.get("/six-s/trend")
async def six_s_trend(
    area: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SixSService.get_trend(db, fid, area)


# ---- VSM ----

@router.post("/vsm")
async def create_vsm(
    data: VSMCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    vsm = await VSMService.create(db, fid, user.id, data.model_dump())
    return {"id": vsm.id, "pce_ratio": vsm.pce_ratio, "total_lead_time_days": vsm.total_lead_time_days}


@router.get("/vsm", response_model=list[VSMResponse])
async def list_vsm(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await VSMService.list_maps(db, fid, skip=skip, limit=limit)


# ---- A3 REPORT ----

@router.post("/a3")
async def create_a3(
    data: A3ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    report = await A3Service.create(db, fid, user.id, data.model_dump())
    return {"id": report.id, "status": str(report.status).lower() if report.status else report.status}


@router.get("/a3", response_model=list[A3ReportResponse])
async def list_a3(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await A3Service.list_reports(db, fid, skip=skip, limit=limit)


@router.patch("/a3/{report_id}/status", response_model=A3ReportResponse)
async def update_a3_status(
    report_id: int,
    status: str,
    results: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await A3Service.update_status(db, report_id, status, results, factory_id=fid)


# ---- GEMBA WALK ----

@router.post("/gemba")
async def create_gemba_walk(
    data: GembaWalkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    try:
        walk = await GembaService.create_walk(db, fid, user.id, data.model_dump())
        await db.commit()
        await db.refresh(walk, ["observations"])

        # Auto-create Kaizen items for actionable Gemba observations
        try:
            from app.models.lean import KaizenItem
            for obs in (walk.observations or []):
                if obs.observation_type in ("safety", "problem", "waste") or (obs.priority and obs.priority in ("high", "critical")):
                    kaizen = KaizenItem(
                        factory_id=fid,
                        title=f"[Gemba] {obs.description[:80] if obs.description else 'Observation'}",
                        description=obs.description or "Gemba walk observation requiring action",
                        category="safety" if obs.observation_type == "safety" else "productivity",
                        priority=obs.priority or "medium",
                        status="idea",
                        created_by_id=user.id,
                        source_type="gemba",
                        source_id=obs.id,
                    )
                    db.add(kaizen)
            await db.commit()
        except Exception as e:
            logger.error("gemba_kaizen_failed", error=str(e))

        obs_ids = [obs.id for obs in (walk.observations or [])]
        return {"id": walk.id, "observation_ids": obs_ids}
    except Exception as e:
        await db.rollback()
        logger.error("gemba_walk_create_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to save Gemba Walk")


@router.get("/gemba")
async def list_gemba_walks(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    try:
        walks = await GembaService.list_walks(db, fid, skip=skip, limit=limit)
        # Manually serialize to avoid response_model validation errors
        result = []
        for w in walks:
            obs_list = []
            for obs in (w.observations or []):
                obs_list.append({
                    "id": obs.id,
                    "observation_type": obs.observation_type,
                    "description": obs.description,
                    "location": obs.location,
                    "action_required": obs.action_required or False,
                    "assigned_to": obs.assigned_to,
                    "due_date": obs.due_date.isoformat() if obs.due_date else None,
                    "priority": obs.priority or "medium",
                    "photo_url": obs.photo_url,
                })
            result.append({
                "id": w.id,
                "area": w.area,
                "walk_date": w.walk_date.isoformat() if w.walk_date else None,
                "duration_min": w.duration_min,
                "theme": w.theme,
                "summary": w.summary,
                "observations": obs_list,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("gemba_list_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to list Gemba walks")


# ---- TPM ----

@router.post("/tpm/equipment")
async def create_tpm_equipment(
    data: TPMEquipmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    eq = await TPMService.create_equipment(db, fid, data.model_dump())
    return {"id": eq.id, "name": eq.name}


@router.get("/tpm/equipment")
async def list_tpm_equipment(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    items = await TPMService.list_equipment(db, fid)
    # Manually serialize ORM objects to dicts for JSON response
    return [
        {
            "id": eq.id,
            "factory_id": eq.factory_id,
            "name": eq.name,
            "location": eq.location,
            "equipment_type": eq.equipment_code,
            "criticality": eq.criticality,
            "maintenance_interval_days": eq.maintenance_interval_days,
            "last_maintenance_date": eq.last_maintenance_date.isoformat() if eq.last_maintenance_date else None,
            "next_planned_maintenance": eq.next_planned_maintenance.isoformat() if eq.next_planned_maintenance else None,
            "mtbf_hours": eq.mtbf_hours,
            "mttr_hours": eq.mttr_hours,
            "created_at": eq.created_at.isoformat() if eq.created_at else None,
        }
        for eq in items
    ]


@router.post("/tpm/maintenance")
async def log_tpm_maintenance(
    data: TPMMaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await TPMService.log_maintenance(db, user.id, data.model_dump(), factory_id=fid)
    return {"id": record.id}


@router.get("/tpm/overdue")
async def get_overdue_equipment(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return equipment where next PM date is past due."""
    fid = require_factory(user)
    items = await TPMService.get_overdue_equipment(db, fid)
    return [
        {
            "id": eq.id,
            "name": eq.name,
            "location": eq.location,
            "criticality": eq.criticality,
            "next_planned_maintenance": eq.next_planned_maintenance.isoformat() if eq.next_planned_maintenance else None,
            "maintenance_interval_days": eq.maintenance_interval_days,
            "last_maintenance_date": eq.last_maintenance_date.isoformat() if eq.last_maintenance_date else None,
        }
        for eq in items
    ]


@router.get("/tpm/equipment/{equipment_id}/metrics")
async def get_equipment_metrics(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Calculate MTBF and MTTR for equipment from maintenance records."""
    from sqlalchemy import select, func, and_
    from app.models.lean_advanced import TPMEquipment, TPMMaintenanceRecord

    fid = require_factory(user)

    try:
        # Get equipment
        eq_q = select(TPMEquipment).where(
            TPMEquipment.id == equipment_id,
            TPMEquipment.factory_id == fid,
        )
        eq_r = await db.execute(eq_q)
        equipment = eq_r.scalar_one_or_none()
    except Exception as e:
        logger.error("tpm_equipment_load_failed", error=str(e), equipment_id=equipment_id)
        raise HTTPException(500, "Failed to load equipment")
    if not equipment:
        raise HTTPException(404, "Equipment not found")

    # Get corrective maintenance records (breakdowns)
    maint_q = select(TPMMaintenanceRecord).where(
        and_(
            TPMMaintenanceRecord.equipment_id == equipment_id,
            TPMMaintenanceRecord.maintenance_type == "corrective",
        )
    ).order_by(TPMMaintenanceRecord.date_performed)
    maint_r = await db.execute(maint_q)
    breakdowns = maint_r.scalars().all()

    # Calculate MTBF (mean time between failures)
    mtbf_hours = None
    if len(breakdowns) >= 2:
        total_hours = 0
        for i in range(1, len(breakdowns)):
            delta = breakdowns[i].date_performed - breakdowns[i - 1].date_performed
            total_hours += delta.total_seconds() / 3600
        mtbf_hours = round(total_hours / (len(breakdowns) - 1), 1)

    # Calculate MTTR (mean time to repair)
    mttr_hours = None
    repair_times = [b.duration_min for b in breakdowns if b.duration_min]
    if repair_times:
        mttr_hours = round(sum(repair_times) / len(repair_times) / 60, 1)

    # Update equipment record with calculated values
    if mtbf_hours is not None:
        equipment.mtbf_hours = mtbf_hours
    if mttr_hours is not None:
        equipment.mttr_hours = mttr_hours
    await db.commit()

    return {
        "equipment_id": equipment_id,
        "equipment_name": equipment.name,
        "mtbf_hours": mtbf_hours,
        "mttr_hours": mttr_hours,
        "total_breakdowns": len(breakdowns),
        "availability_pct": round(mtbf_hours / (mtbf_hours + mttr_hours) * 100, 1) if mtbf_hours and mttr_hours else None,
    }


# ---- CILT ----

@router.post("/cilt/standards")
async def create_cilt_standard(
    data: CILTStandardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    standard = await CILTService.create_standard(db, fid, data.model_dump())
    return {"id": standard.id, "name": standard.name}


@router.get("/cilt/standards")
async def list_cilt_standards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    standards = await CILTService.list_standards(db, fid)
    # Manually serialize ORM objects to dicts for JSON response
    return [
        {
            "id": s.id,
            "factory_id": s.factory_id,
            "name": s.name,
            "equipment_id": getattr(s, "equipment_id", None),
            "frequency": str(s.frequency).lower() if s.frequency else None,
            "checks": s.checks if hasattr(s, "checks") else [],
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in standards
    ]


@router.post("/cilt/execute")
async def execute_cilt(
    data: CILTExecutionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    execution = await CILTService.execute_cilt(db, user.id, data.model_dump(), factory_id=fid)
    return {"id": execution.id, "all_ok": execution.all_ok}


@router.get("/cilt/compliance")
async def cilt_compliance(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await CILTService.get_compliance_rate(db, fid)


# ---- ANDON ----

@router.post("/andon")
async def create_andon_event(
    data: AndonEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    event = await AndonService.create_event(db, fid, user.id, data.model_dump())

    # Auto-create Safety incident for RED Andon events with safety-related reasons
    safety_reasons = {"safety_hold", "safety", "injury", "hazard", "spill", "fire"}
    reason_lower = (data.reason or "").lower()
    if str(event.status).lower() == "red" and any(r in reason_lower for r in safety_reasons):
        try:
            from app.models.safety import SafetyIncident
            incident = SafetyIncident(
                factory_id=fid,
                created_by_id=user.id,
                date=event.created_at or __import__("datetime").datetime.now(__import__("datetime").timezone.utc),
                incident_type="near_miss",
                severity="high",
                title=f"[Andon] {data.description or data.reason or 'RED alert'}",
                description=data.description or f"Andon RED triggered: {data.reason}",
                location=f"Line {data.production_line_id}",
                production_line_id=data.production_line_id,
            )
            db.add(incident)
            await db.commit()
        except Exception as e:
            logger.error("andon_safety_failed", error=str(e))

    return {"id": event.id, "status": str(event.status).lower() if event.status else event.status}


@router.post("/andon/{event_id}/resolve")
async def resolve_andon(
    event_id: int,
    data: AndonResolve | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    notes = data.resolution_notes if data else None
    event = await AndonService.resolve_event(db, event_id, resolution_notes=notes, factory_id=fid)
    return {"id": event.id, "resolution_time_min": event.resolution_time_min}


@router.get("/andon/status")
async def andon_current_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    try:
        events = await AndonService.get_current_status(db, fid)
        # Manually serialize ORM objects to dicts for JSON response
        result = []
        for e in events:
            result.append({
                "id": e.id,
                "factory_id": e.factory_id,
                "production_line_id": e.production_line_id,
                "triggered_by_id": e.triggered_by_id,
                "status": str(e.status).lower() if e.status else e.status,
                "reason": e.reason,
                "description": e.description,
                "triggered_at": e.triggered_at.isoformat() if e.triggered_at else None,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "resolution_time_min": e.resolution_time_min,
                "escalated": e.escalated or False,
                "escalated_at": e.escalated_at.isoformat() if e.escalated_at else None,
                "escalation_count": e.escalation_count or 0,
                "source": e.source,
                "trigger_type": e.trigger_type,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("andon_status_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to fetch Andon status")


@router.get("/andon/check-escalation")
async def check_andon_escalation(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger andon escalation check. Can be called by cron/scheduler.

    Finds unresolved andon events exceeding time thresholds and auto-escalates them.
    """
    fid = require_factory(user)
    escalated = await AndonService.check_escalation(db, fid)
    return {"escalated_count": len(escalated), "escalated_events": escalated}


@router.post("/andon/detect-patterns")
async def detect_andon_patterns(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Detect recurring Andon patterns (same reason 3+ times in 7 days on a line)
    and auto-create Kaizen items for each pattern found."""
    fid = require_factory(user)
    try:
        result = await AndonService.detect_patterns(db, fid, user.id)
        await db.commit()
        return result
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error("andon_pattern_detection_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to detect Andon patterns")


# ---- AUDIT SCHEDULE AUTO-RECURRENCE ----

@router.post("/audit-schedule/{schedule_id}/complete-and-recur")
async def complete_audit_and_create_next(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark audit schedule as completed and auto-create the next recurrence."""
    fid = require_factory(user)
    completed, next_sched = await AuditScheduleService.complete_and_create_next(db, schedule_id, fid)
    return {
        "completed": {
            "id": completed.id,
            "title": completed.title,
            "last_completed_date": str(completed.last_completed_date),
            "next_due_date": str(completed.next_due_date),
        },
        "next_schedule": {
            "id": next_sched.id,
            "title": next_sched.title,
            "next_due_date": str(next_sched.next_due_date),
            "frequency": next_sched.frequency,
        },
    }


# ---- HOURLY PRODUCTION ----

@router.post("/hourly")
async def log_hourly_production(
    data: HourlyProductionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await HourlyProductionService.log_hour(db, data.model_dump(), factory_id=fid)
    return {"id": record.id, "is_win": record.is_win}


@router.get("/hourly/{line_id}")
async def get_hourly_view(
    line_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    try:
        dt = datetime.fromisoformat(date)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD or ISO format.")
    return await HourlyProductionService.get_day_view(db, line_id, dt, factory_id=fid)


# ---- VSM LIVE DATA ----

@router.get("/vsm/{vsm_id}/live-data")
async def vsm_live_data(
    vsm_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get live OEE, cycle time, WIP, and uptime overlay data for each VSM step."""
    from sqlalchemy import select, func, and_, cast
    from sqlalchemy import Date
    from app.models.lean_advanced import VSMMap, VSMStep
    from app.models.lean import OEERecord
    from app.models.production import ProductionRecord, DowntimeEvent
    from app.models.factory import ProductionLine

    fid = require_factory(user)

    # Load VSM map with factory scoping
    result = await db.execute(
        select(VSMMap).where(VSMMap.id == vsm_id, VSMMap.factory_id == fid)
    )
    vsm_map = result.scalar_one_or_none()
    if not vsm_map:
        raise HTTPException(404, "VSM map not found")

    # Load steps
    steps_result = await db.execute(
        select(VSMStep).where(VSMStep.vsm_map_id == vsm_id).order_by(VSMStep.step_order)
    )
    steps = steps_result.scalars().all()

    # Load all production lines for matching by name
    lines_result = await db.execute(
        select(ProductionLine).where(ProductionLine.factory_id == fid)
    )
    lines = lines_result.scalars().all()
    line_name_map = {l.name.lower().strip(): l for l in lines}

    today = datetime.now(timezone.utc).date()
    step_data = []

    for step in steps:
        live = {
            "step_id": step.id,
            "process_name": step.process_name,
            "live_oee": None,
            "live_cycle_time": None,
            "live_wip": None,
            "live_uptime": None,
        }

        # Try to match step to a production line by process_name
        matched_line = line_name_map.get((step.process_name or "").lower().strip())
        if matched_line:
            line_id = matched_line.id

            # Latest OEE record
            try:
                oee_q = (
                    select(OEERecord)
                    .where(OEERecord.production_line_id == line_id)
                    .order_by(OEERecord.date.desc())
                    .limit(1)
                )
                oee_r = await db.execute(oee_q)
                oee_rec = oee_r.scalar_one_or_none()
                if oee_rec:
                    live["live_oee"] = round(oee_rec.oee, 1) if oee_rec.oee else None
            except Exception as e:
                logger.warning(f"VSM live data query failed for step {step.id}: {e}")

            # Latest production record -> actual cycle time, WIP proxy
            try:
                prod_q = (
                    select(ProductionRecord)
                    .where(ProductionRecord.production_line_id == line_id)
                    .order_by(ProductionRecord.date.desc())
                    .limit(1)
                )
                prod_r = await db.execute(prod_q)
                prod_rec = prod_r.scalar_one_or_none()
                if prod_rec and prod_rec.total_pieces and prod_rec.actual_run_time_min:
                    live["live_cycle_time"] = round(
                        (prod_rec.actual_run_time_min * 60) / max(prod_rec.total_pieces, 1), 1
                    )
                    # WIP approximation: total - good pieces
                    live["live_wip"] = max(0, (prod_rec.total_pieces or 0) - (prod_rec.good_pieces or 0))
            except Exception as e:
                logger.warning(f"VSM live data query failed for step {step.id}: {e}")

            # Today's uptime: 100% minus downtime percentage
            try:
                dt_q = select(func.sum(DowntimeEvent.duration_minutes)).where(
                    and_(
                        DowntimeEvent.production_line_id == line_id,
                        cast(DowntimeEvent.start_time, Date) == today,
                    )
                )
                dt_r = await db.execute(dt_q)
                total_downtime = dt_r.scalar() or 0
                # Assume 480 min shift as baseline
                uptime_pct = max(0, round((1 - total_downtime / 480) * 100, 1))
                live["live_uptime"] = uptime_pct
            except Exception as e:
                logger.warning(f"VSM live data query failed for step {step.id}: {e}")

        step_data.append(live)

    return {"steps": step_data}


# ---- MIND MAP ----

from pydantic import BaseModel as PydanticBaseModel


class MindMapCreate(PydanticBaseModel):
    title: str = ""
    description: str = ""
    nodes: list = []
    connectors: list = []


class MindMapUpdate(PydanticBaseModel):
    title: str | None = None
    description: str | None = None
    nodes: list | None = None
    connectors: list | None = None


@router.post("/mindmap")
async def create_mind_map(
    data: MindMapCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    try:
        mind_map = MindMap(
            factory_id=fid,
            created_by_id=user.id,
            title=data.title,
            description=data.description,
            nodes=data.nodes,
            connectors=data.connectors,
        )
        db.add(mind_map)
        await db.flush()
        await db.commit()
        return {"id": mind_map.id, "title": mind_map.title}
    except Exception as e:
        await db.rollback()
        logger.error("mindmap_create_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to create mind map")


@router.get("/mindmap")
async def list_mind_maps(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap)
        .where(MindMap.factory_id == fid)
        .order_by(MindMap.created_at.desc())
    )
    maps = result.scalars().all()
    return [
        {
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "nodes": m.nodes,
            "connectors": m.connectors,
            "created_at": m.created_at.isoformat() if m.created_at else "",
            "updated_at": m.updated_at.isoformat() if m.updated_at else "",
        }
        for m in maps
    ]


@router.get("/mindmap/{map_id}")
async def get_mind_map(
    map_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    return {
        "id": mind_map.id,
        "title": mind_map.title,
        "description": mind_map.description,
        "nodes": mind_map.nodes,
        "connectors": mind_map.connectors,
        "created_at": mind_map.created_at.isoformat() if mind_map.created_at else "",
        "updated_at": mind_map.updated_at.isoformat() if mind_map.updated_at else "",
    }


@router.patch("/mindmap/{map_id}")
async def update_mind_map(
    map_id: int,
    data: MindMapUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    if data.title is not None:
        mind_map.title = data.title
    if data.description is not None:
        mind_map.description = data.description
    if data.nodes is not None:
        mind_map.nodes = data.nodes
        flag_modified(mind_map, "nodes")
    if data.connectors is not None:
        mind_map.connectors = data.connectors
        flag_modified(mind_map, "connectors")
    await db.commit()
    return {"id": mind_map.id, "title": mind_map.title}


@router.delete("/mindmap/{map_id}")
async def delete_mind_map(
    map_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    await db.delete(mind_map)
    await db.commit()
    return {"status": "deleted"}


# ---- GEMBA OBSERVATION PHOTO ----

from app.services.upload_service import save_upload, resolve_upload_path, IMAGE_TYPES
from app.services import storage as storage_svc


@router.post("/gemba/observations/{observation_id}/photo")
async def upload_gemba_photo(
    observation_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a photo for a Gemba walk observation."""
    from app.models.lean_advanced import GembaObservation
    fid = require_factory(user)

    result = await db.execute(
        select(GembaObservation).where(GembaObservation.id == observation_id)
    )
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(404, "Observation not found")

    # Verify factory scope via the parent walk
    from app.models.lean_advanced import GembaWalk
    walk_result = await db.execute(
        select(GembaWalk).where(GembaWalk.id == obs.walk_id, GembaWalk.factory_id == fid)
    )
    if not walk_result.scalar_one_or_none():
        raise HTTPException(403, "Observation does not belong to your factory")

    relative_path, file_size = await save_upload(file, "gemba", fid, IMAGE_TYPES)
    obs.photo_url = relative_path
    await db.commit()
    return {"photo_url": f"/api/v1/lean-advanced/gemba/observations/{observation_id}/photo", "file_size": file_size}


@router.get("/gemba/observations/{observation_id}/photo")
async def get_gemba_photo(
    observation_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve a Gemba observation photo."""
    from app.models.lean_advanced import GembaObservation, GembaWalk
    fid = require_factory(user)

    result = await db.execute(
        select(GembaObservation).where(GembaObservation.id == observation_id)
    )
    obs = result.scalar_one_or_none()
    if not obs or not obs.photo_url:
        raise HTTPException(404, "Photo not found")

    walk_result = await db.execute(
        select(GembaWalk).where(GembaWalk.id == obs.walk_id, GembaWalk.factory_id == fid)
    )
    if not walk_result.scalar_one_or_none():
        raise HTTPException(403, "Observation does not belong to your factory")

    # Build storage key from DB relative path
    safe = os.path.basename(obs.photo_url.split("/")[-1])
    factory_id_str = obs.photo_url.split("/")[0]
    storage_key = f"{factory_id_str}/gemba/{safe}"

    presigned = await storage_svc.generate_presigned_url(storage_key)
    if presigned:
        return RedirectResponse(url=presigned, status_code=302)

    file_bytes = await storage_svc.get_file_bytes(storage_key)
    ext = os.path.splitext(safe)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return Response(content=file_bytes, media_type=mime)


# ---- GEMBA OBSERVATION → KAIZEN LINK ----

@router.post("/gemba/observations/{observation_id}/link-kaizen/{kaizen_id}")
async def link_gemba_kaizen(
    observation_id: int,
    kaizen_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Link a gemba observation to a kaizen item (set linked_kaizen_id)."""
    fid = require_factory(user)
    from app.models.lean_advanced import GembaObservation, GembaWalk
    from app.models.lean import KaizenItem

    obs_result = await db.execute(
        select(GembaObservation).where(GembaObservation.id == observation_id)
    )
    obs = obs_result.scalar_one_or_none()
    if not obs:
        raise HTTPException(404, "Observation not found")

    walk_result = await db.execute(
        select(GembaWalk).where(GembaWalk.id == obs.walk_id, GembaWalk.factory_id == fid)
    )
    if not walk_result.scalar_one_or_none():
        raise HTTPException(403, "Observation does not belong to your factory")

    kaizen_result = await db.execute(
        select(KaizenItem).where(KaizenItem.id == kaizen_id, KaizenItem.factory_id == fid)
    )
    if not kaizen_result.scalar_one_or_none():
        raise HTTPException(404, "Kaizen item not found in your factory")

    obs.linked_kaizen_id = kaizen_id
    await db.commit()
    return {"status": "linked", "observation_id": observation_id, "kaizen_id": kaizen_id}


# ---- 6S AUDIT ITEM PHOTO ----

@router.post("/6s/audits/{audit_id}/items/{item_id}/photo")
async def upload_sixs_photo(
    audit_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload evidence photo for a 6S audit item."""
    from app.models.lean_advanced import SixSAudit, SixSAuditItem
    fid = require_factory(user)

    audit_result = await db.execute(
        select(SixSAudit).where(SixSAudit.id == audit_id, SixSAudit.factory_id == fid)
    )
    if not audit_result.scalar_one_or_none():
        raise HTTPException(404, "Audit not found")

    item_result = await db.execute(
        select(SixSAuditItem).where(SixSAuditItem.id == item_id, SixSAuditItem.audit_id == audit_id)
    )
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Audit item not found")

    relative_path, file_size = await save_upload(file, "sixs", fid, IMAGE_TYPES)
    item.photo_url = relative_path
    await db.commit()
    return {"photo_url": f"/api/v1/lean-advanced/6s/audits/{audit_id}/items/{item_id}/photo", "file_size": file_size}


@router.get("/6s/audits/{audit_id}/items/{item_id}/photo")
async def get_sixs_photo(
    audit_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve a 6S audit item evidence photo."""
    from app.models.lean_advanced import SixSAudit, SixSAuditItem
    fid = require_factory(user)

    audit_result = await db.execute(
        select(SixSAudit).where(SixSAudit.id == audit_id, SixSAudit.factory_id == fid)
    )
    if not audit_result.scalar_one_or_none():
        raise HTTPException(404, "Audit not found")

    item_result = await db.execute(
        select(SixSAuditItem).where(SixSAuditItem.id == item_id, SixSAuditItem.audit_id == audit_id)
    )
    item = item_result.scalar_one_or_none()
    if not item or not item.photo_url:
        raise HTTPException(404, "Photo not found")

    # Build storage key from DB relative path
    safe = os.path.basename(item.photo_url.split("/")[-1])
    factory_id_str = item.photo_url.split("/")[0]
    storage_key = f"{factory_id_str}/sixs/{safe}"

    presigned = await storage_svc.generate_presigned_url(storage_key)
    if presigned:
        return RedirectResponse(url=presigned, status_code=302)

    file_bytes = await storage_svc.get_file_bytes(storage_key)
    ext = os.path.splitext(safe)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return Response(content=file_bytes, media_type=mime)
