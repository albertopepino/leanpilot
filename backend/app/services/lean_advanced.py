from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta, date

from app.models.lean_advanced import (
    SixSAudit, SixSAuditItem, SixSCategory,
    VSMMap, VSMStep,
    A3Report, A3Status,
    GembaWalk, GembaObservation,
    TPMEquipment, TPMMaintenanceRecord,
    CILTStandard, CILTItem, CILTExecution, CILTCheck,
    AndonEvent,
    HourlyProduction,
)


class SixSService:
    @staticmethod
    async def create_audit(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> SixSAudit:
        audit = SixSAudit(
            factory_id=factory_id,
            auditor_id=user_id,
            area_name=data["area_name"],
            production_line_id=data.get("production_line_id"),
            notes=data.get("notes"),
        )
        db.add(audit)
        await db.flush()

        total_score = 0
        count = 0
        for item_data in data.get("items", []):
            item = SixSAuditItem(
                audit_id=audit.id,
                category=item_data["category"],
                question=item_data["question"],
                score=item_data["score"],
                finding=item_data.get("finding"),
                corrective_action=item_data.get("corrective_action"),
                responsible=item_data.get("responsible"),
                due_date=item_data.get("due_date"),
            )
            db.add(item)
            total_score += item_data["score"]
            count += 1

        if count > 0:
            max_possible = count * 5
            audit.overall_score = round((total_score / max_possible) * 100, 1)
            avg = total_score / count
            audit.maturity_level = min(5, max(1, round(avg)))

        await db.flush()
        return audit

    @staticmethod
    async def list_audits(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(SixSAudit)
            .options(selectinload(SixSAudit.items))
            .where(SixSAudit.factory_id == factory_id)
            .order_by(SixSAudit.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def get_trend(db: AsyncSession, factory_id: int, area: str | None = None):
        query = select(SixSAudit).where(SixSAudit.factory_id == factory_id)
        if area:
            query = query.where(SixSAudit.area_name == area)
        query = query.order_by(SixSAudit.audit_date.asc())
        result = await db.execute(query)
        audits = result.scalars().all()
        return [{"date": a.audit_date, "score": a.overall_score, "level": a.maturity_level} for a in audits]


class VSMService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> VSMMap:
        vsm = VSMMap(
            factory_id=factory_id,
            created_by_id=user_id,
            title=data["title"],
            product_family=data["product_family"],
            map_type=data.get("map_type", "current"),
            takt_time_sec=data.get("takt_time_sec"),
            customer_demand_per_day=data.get("customer_demand_per_day"),
            notes=data.get("notes"),
        )
        db.add(vsm)
        await db.flush()

        total_processing = 0
        total_lead = 0
        for step_data in data.get("steps", []):
            step = VSMStep(
                vsm_map_id=vsm.id,
                step_order=step_data["step_order"],
                process_name=step_data["process_name"],
                cycle_time_sec=step_data.get("cycle_time_sec"),
                changeover_time_min=step_data.get("changeover_time_min"),
                uptime_pct=step_data.get("uptime_pct"),
                operators=step_data.get("operators"),
                wip_before=step_data.get("wip_before"),
                wait_time_hours=step_data.get("wait_time_hours"),
                is_bottleneck=step_data.get("is_bottleneck", False),
                is_kaizen_burst=step_data.get("is_kaizen_burst", False),
                notes=step_data.get("notes"),
            )
            db.add(step)
            if step.cycle_time_sec:
                total_processing += step.cycle_time_sec / 60
            if step.wait_time_hours:
                total_lead += step.wait_time_hours / 24

        vsm.total_processing_time_min = round(total_processing, 2)
        vsm.total_lead_time_days = round(total_lead + total_processing / 1440, 2)
        if vsm.total_lead_time_days > 0:
            vsm.pce_ratio = round((total_processing / 1440) / vsm.total_lead_time_days * 100, 2)

        await db.flush()
        return vsm

    @staticmethod
    async def list_maps(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(VSMMap)
            .options(selectinload(VSMMap.steps))
            .where(VSMMap.factory_id == factory_id)
            .order_by(VSMMap.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()


class A3Service:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> A3Report:
        report = A3Report(
            factory_id=factory_id,
            created_by_id=user_id,
            title=data["title"],
            background=data.get("background"),
            current_condition=data.get("current_condition"),
            goal_statement=data.get("goal_statement"),
            root_cause_analysis=data.get("root_cause_analysis"),
            countermeasures=data.get("countermeasures"),
            implementation_plan=data.get("implementation_plan"),
            follow_up=data.get("follow_up"),
            results=data.get("results"),
            target_date=data.get("target_date"),
            five_why_id=data.get("five_why_id"),
            ishikawa_id=data.get("ishikawa_id"),
            mentor_name=data.get("mentor_name"),
            mentor_date=data.get("mentor_date"),
            mentor_feedback=data.get("mentor_feedback"),
            mentor_status=data.get("mentor_status"),
        )
        db.add(report)
        await db.flush()
        return report

    @staticmethod
    async def list_reports(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(A3Report)
            .where(A3Report.factory_id == factory_id)
            .order_by(A3Report.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def update_status(db: AsyncSession, report_id: int, status: str, results: str | None = None, factory_id: int | None = None):
        result = await db.execute(select(A3Report).where(A3Report.id == report_id))
        report = result.scalar_one()
        if factory_id is not None and report.factory_id != factory_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="A3 report does not belong to your factory")
        report.status = status.lower() if status else status
        if results:
            report.results = results
        if status and status.lower() == "completed":
            report.completion_date = datetime.now(timezone.utc)
        await db.flush()
        return report


class GembaService:
    @staticmethod
    async def create_walk(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> GembaWalk:
        walk = GembaWalk(
            factory_id=factory_id,
            walker_id=user_id,
            area=data["area"],
            duration_min=data.get("duration_min"),
            theme=data.get("theme"),
            summary=data.get("summary"),
        )
        db.add(walk)
        await db.flush()

        for obs_data in data.get("observations", []):
            obs = GembaObservation(
                walk_id=walk.id,
                observation_type=obs_data["observation_type"],
                description=obs_data["description"],
                location=obs_data.get("location"),
                action_required=obs_data.get("action_required", False),
                assigned_to=obs_data.get("assigned_to"),
                due_date=obs_data.get("due_date"),
                priority=obs_data.get("priority", "medium"),
            )
            db.add(obs)

        await db.flush()
        return walk

    @staticmethod
    async def list_walks(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(GembaWalk)
            .options(selectinload(GembaWalk.observations))
            .where(GembaWalk.factory_id == factory_id)
            .order_by(GembaWalk.walk_date.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()


class TPMService:
    @staticmethod
    async def create_equipment(db: AsyncSession, factory_id: int, data: dict) -> TPMEquipment:
        interval_days = data.get("maintenance_interval_days", 30)
        equipment = TPMEquipment(
            factory_id=factory_id,
            production_line_id=data.get("production_line_id"),
            name=data["name"],
            equipment_code=data.get("equipment_code"),
            location=data.get("location"),
            criticality=data.get("criticality", "medium"),
            mtbf_hours=data.get("mtbf_hours"),
            mttr_hours=data.get("mttr_hours"),
            maintenance_interval_days=interval_days,
            last_maintenance_date=datetime.now(timezone.utc),
            next_planned_maintenance=datetime.now(timezone.utc) + timedelta(days=interval_days),
        )
        db.add(equipment)
        await db.flush()
        return equipment

    @staticmethod
    async def list_equipment(db: AsyncSession, factory_id: int):
        result = await db.execute(
            select(TPMEquipment).where(TPMEquipment.factory_id == factory_id).order_by(TPMEquipment.name)
        )
        return result.scalars().all()

    @staticmethod
    async def log_maintenance(db: AsyncSession, user_id: int, data: dict, factory_id: int | None = None) -> TPMMaintenanceRecord:
        # Verify equipment belongs to the user's factory and fetch it for auto-scheduling
        eq_result = await db.execute(
            select(TPMEquipment).where(
                TPMEquipment.id == data["equipment_id"],
                *([TPMEquipment.factory_id == factory_id] if factory_id else []),
            )
        )
        equipment = eq_result.scalar_one_or_none()
        if factory_id and not equipment:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Equipment not found in your factory")

        record = TPMMaintenanceRecord(
            equipment_id=data["equipment_id"],
            performed_by_id=user_id,
            maintenance_type=data["maintenance_type"],
            pillar=data.get("pillar"),
            description=data["description"],
            duration_min=data.get("duration_min"),
            parts_replaced=data.get("parts_replaced", []),
            cost_eur=data.get("cost_eur"),
            findings=data.get("findings"),
            next_action=data.get("next_action"),
        )
        db.add(record)
        await db.flush()

        # Auto-schedule next PM: update equipment dates
        if equipment:
            now = datetime.now(timezone.utc)
            equipment.last_maintenance_date = now
            interval = equipment.maintenance_interval_days or 30
            equipment.next_planned_maintenance = now + timedelta(days=interval)
            await db.flush()

        return record

    @staticmethod
    async def get_overdue_equipment(db: AsyncSession, factory_id: int):
        """Return equipment where next_planned_maintenance is in the past."""
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(TPMEquipment).where(
                TPMEquipment.factory_id == factory_id,
                TPMEquipment.next_planned_maintenance < now,
            ).order_by(TPMEquipment.next_planned_maintenance.asc())
        )
        return result.scalars().all()


class CILTService:
    @staticmethod
    async def create_standard(db: AsyncSession, factory_id: int, data: dict) -> CILTStandard:
        standard = CILTStandard(
            factory_id=factory_id,
            equipment_id=data.get("equipment_id"),
            production_line_id=data.get("production_line_id"),
            name=data["name"],
            area=data.get("area"),
            frequency=data.get("frequency", "daily"),
            estimated_time_min=data.get("estimated_time_min"),
        )
        db.add(standard)
        await db.flush()

        for item_data in data.get("items", []):
            item = CILTItem(
                standard_id=standard.id,
                item_order=item_data["item_order"],
                category=item_data["category"],
                description=item_data["description"],
                method=item_data.get("method"),
                standard_value=item_data.get("standard_value"),
                tool_required=item_data.get("tool_required"),
                time_seconds=item_data.get("time_seconds"),
            )
            db.add(item)

        await db.flush()
        return standard

    @staticmethod
    async def list_standards(db: AsyncSession, factory_id: int):
        result = await db.execute(
            select(CILTStandard).where(CILTStandard.factory_id == factory_id).order_by(CILTStandard.name)
        )
        return result.scalars().all()

    @staticmethod
    async def execute_cilt(db: AsyncSession, user_id: int, data: dict, factory_id: int | None = None) -> CILTExecution:
        # Verify CILT standard belongs to the user's factory (tenant isolation)
        if factory_id:
            std_result = await db.execute(
                select(CILTStandard).where(
                    CILTStandard.id == data["standard_id"],
                    CILTStandard.factory_id == factory_id,
                )
            )
            if not std_result.scalar_one_or_none():
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="CILT standard not found in your factory")

        execution = CILTExecution(
            standard_id=data["standard_id"],
            operator_id=user_id,
            shift=data.get("shift"),
            duration_min=data.get("duration_min"),
            notes=data.get("notes"),
        )
        db.add(execution)
        await db.flush()

        all_ok = True
        for check_data in data.get("checks", []):
            check = CILTCheck(
                execution_id=execution.id,
                item_id=check_data["item_id"],
                status=check_data["status"],
                measured_value=check_data.get("measured_value"),
                anomaly_description=check_data.get("anomaly_description"),
            )
            if check_data["status"] == "nok":
                all_ok = False
            db.add(check)

        execution.all_ok = all_ok
        await db.flush()
        return execution

    @staticmethod
    async def get_compliance_rate(db: AsyncSession, factory_id: int, days: int = 30):
        """Calculate CILT execution compliance rate."""
        result = await db.execute(
            select(CILTStandard).where(CILTStandard.factory_id == factory_id)
        )
        standards = result.scalars().all()
        return {
            "total_standards": len(standards),
            "standards": [{"id": s.id, "name": s.name, "frequency": str(s.frequency).lower() if s.frequency else s.frequency} for s in standards],
        }


class AndonService:
    @staticmethod
    async def create_event(db: AsyncSession, factory_id: int, user_id: int | None, data: dict) -> AndonEvent:
        event = AndonEvent(
            factory_id=factory_id,
            production_line_id=data["production_line_id"],
            triggered_by_id=user_id,
            status=data["status"],
            reason=data.get("reason"),
            description=data.get("description"),
        )
        db.add(event)
        await db.flush()
        return event

    @staticmethod
    async def resolve_event(db: AsyncSession, event_id: int, resolution_notes: str | None = None, factory_id: int | None = None):
        result = await db.execute(select(AndonEvent).where(AndonEvent.id == event_id))
        event = result.scalar_one()
        if factory_id is not None and event.factory_id != factory_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Andon event does not belong to your factory")
        event.resolved_at = datetime.now(timezone.utc)
        if resolution_notes:
            event.description = (event.description or "") + f" | Resolution: {resolution_notes}"
        if event.triggered_at:
            delta = event.resolved_at - event.triggered_at
            event.resolution_time_min = round(delta.total_seconds() / 60, 1)
        await db.flush()
        return event

    @staticmethod
    async def get_current_status(db: AsyncSession, factory_id: int):
        """Get current Andon status for all lines (latest unresolved event per line)."""
        result = await db.execute(
            select(AndonEvent)
            .where(and_(AndonEvent.factory_id == factory_id, AndonEvent.resolved_at.is_(None)))
            .order_by(AndonEvent.triggered_at.desc())
        )
        return result.scalars().all()

    @staticmethod
    async def check_escalation(db: AsyncSession, factory_id: int) -> list[dict]:
        """Find unresolved andon events that exceed escalation thresholds and auto-escalate.

        Default thresholds (minutes without acknowledgement/resolution):
          yellow -> red: 10 min
          red -> red (re-escalate): 5 min
          blue -> red: 15 min

        Returns list of escalated event summaries.
        """
        thresholds = {
            "yellow": 10,
            "red": 5,
            "blue": 15,
        }
        now = datetime.now(timezone.utc)

        result = await db.execute(
            select(AndonEvent).where(
                and_(
                    AndonEvent.factory_id == factory_id,
                    AndonEvent.resolved_at.is_(None),
                )
            )
        )
        events = result.scalars().all()
        escalated = []

        for event in events:
            status_key = (event.status or "").lower()
            threshold_min = thresholds.get(status_key)
            if threshold_min is None:
                continue

            # Check time since last escalation or trigger
            reference_time = event.escalated_at or event.triggered_at
            if reference_time is None:
                continue

            elapsed_min = (now - reference_time).total_seconds() / 60
            if elapsed_min >= threshold_min:
                # Escalate: bump severity to red if not already, increment counter
                previous_status = event.status
                if status_key != "red":
                    event.status = "red"
                event.escalated_at = now
                event.escalation_count = (event.escalation_count or 0) + 1
                event.escalated = True

                escalated.append({
                    "event_id": event.id,
                    "production_line_id": event.production_line_id,
                    "previous_status": previous_status,
                    "new_status": event.status,
                    "escalation_count": event.escalation_count,
                    "elapsed_minutes": round(elapsed_min, 1),
                    "reason": event.reason,
                })

        if escalated:
            await db.flush()

        return escalated


class HourlyProductionService:
    @staticmethod
    async def log_hour(db: AsyncSession, data: dict, factory_id: int | None = None) -> HourlyProduction:
        if factory_id is not None:
            from app.models.factory import ProductionLine
            line_result = await db.execute(
                select(ProductionLine).where(
                    ProductionLine.id == data["production_line_id"],
                    ProductionLine.factory_id == factory_id,
                )
            )
            if not line_result.scalar_one_or_none():
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Production line does not belong to your factory")
        record = HourlyProduction(
            production_line_id=data["production_line_id"],
            date=data["date"],
            hour=data["hour"],
            shift=data.get("shift"),
            target_pieces=data["target_pieces"],
            actual_pieces=data["actual_pieces"],
            scrap_pieces=data.get("scrap_pieces", 0),
            downtime_min=data.get("downtime_min", 0),
            is_win=data["actual_pieces"] >= data["target_pieces"],
            notes=data.get("notes"),
        )
        db.add(record)
        await db.flush()
        return record

    @staticmethod
    async def get_day_view(db: AsyncSession, line_id: int, date: datetime, factory_id: int | None = None):
        """Get hour-by-hour production for a day (Redzone-style)."""
        if factory_id is not None:
            from app.models.factory import ProductionLine
            line_result = await db.execute(
                select(ProductionLine).where(
                    ProductionLine.id == line_id,
                    ProductionLine.factory_id == factory_id,
                )
            )
            if not line_result.scalar_one_or_none():
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="Production line does not belong to your factory")
        from sqlalchemy import and_
        result = await db.execute(
            select(HourlyProduction)
            .where(and_(
                HourlyProduction.production_line_id == line_id,
                func.date(HourlyProduction.date) == date.date(),
            ))
            .order_by(HourlyProduction.hour)
        )
        hours = result.scalars().all()
        total_target = sum(h.target_pieces for h in hours)
        total_actual = sum(h.actual_pieces for h in hours)
        return {
            "line_id": line_id,
            "date": date.isoformat(),
            "hours": [
                {
                    "hour": h.hour,
                    "target": h.target_pieces,
                    "actual": h.actual_pieces,
                    "scrap": h.scrap_pieces,
                    "downtime_min": h.downtime_min,
                    "is_win": h.is_win,
                }
                for h in hours
            ],
            "total_target": total_target,
            "total_actual": total_actual,
            "overall_win": total_actual >= total_target,
            "win_rate_pct": round(sum(1 for h in hours if h.is_win) / max(len(hours), 1) * 100, 1),
        }


class AuditScheduleService:
    """Auto-recurrence logic for audit schedules."""

    FREQ_DAYS = {
        "daily": 1,
        "weekly": 7,
        "biweekly": 14,
        "monthly": 30,
        "quarterly": 90,
    }

    @staticmethod
    async def complete_and_create_next(db: AsyncSession, schedule_id: int, factory_id: int):
        """Mark an audit schedule as completed and auto-create the next recurrence.

        Returns (completed_schedule, next_schedule).
        """
        from app.models.audit_schedule import AuditSchedule

        result = await db.execute(
            select(AuditSchedule).where(
                AuditSchedule.id == schedule_id,
                AuditSchedule.factory_id == factory_id,
            )
        )
        schedule = result.scalar_one_or_none()
        if not schedule:
            from fastapi import HTTPException
            raise HTTPException(404, "Schedule not found")

        today = date.today()
        schedule.last_completed_date = today

        # Calculate next due date
        delta_days = AuditScheduleService.FREQ_DAYS.get(schedule.frequency, 30)
        next_due = today + timedelta(days=delta_days)
        schedule.next_due_date = next_due

        # Auto-create the next scheduled audit entry
        next_schedule = AuditSchedule(
            factory_id=schedule.factory_id,
            created_by_id=schedule.created_by_id,
            audit_type=schedule.audit_type,
            title=schedule.title,
            area=schedule.area,
            production_line_id=schedule.production_line_id,
            assigned_to_id=schedule.assigned_to_id,
            frequency=schedule.frequency,
            next_due_date=next_due,
            last_completed_date=None,
            is_active=True,
            escalation_days=schedule.escalation_days,
            notes=schedule.notes,
        )
        db.add(next_schedule)
        await db.flush()

        return schedule, next_schedule
