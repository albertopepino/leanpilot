"""QC Service — complete_check logic with Andon auto-trigger and NCR creation."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.models.qc import (
    DefectCatalog, QCTemplate, QCTemplateItem, QCRecord, QCCheckResultRecord,
    NonConformanceReport, CAPAAction,
    QCRecordStatus, QCCheckResult, DefectSeverity, NCRStatus,
    QCCheckType, QCItemCheckType,
)
from app.models.lean_advanced import AndonEvent, AndonStatus
from app.models.manufacturing import ProductionOrder, POStatus


class DefectCatalogService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, data: dict) -> DefectCatalog:
        defect = DefectCatalog(factory_id=factory_id, **data)
        db.add(defect)
        await db.commit()
        await db.refresh(defect)
        return defect

    @staticmethod
    async def list_all(
        db: AsyncSession, factory_id: int,
        product_id: int | None = None,
        line_id: int | None = None,
        active_only: bool = True,
    ):
        q = select(DefectCatalog).where(DefectCatalog.factory_id == factory_id)
        if active_only:
            q = q.where(DefectCatalog.is_active == True)
        if product_id:
            q = q.where(
                (DefectCatalog.product_id == product_id) | (DefectCatalog.product_id.is_(None))
            )
        if line_id:
            q = q.where(
                (DefectCatalog.production_line_id == line_id) | (DefectCatalog.production_line_id.is_(None))
            )
        q = q.order_by(DefectCatalog.sort_order, DefectCatalog.name)
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def update(db: AsyncSession, defect_id: int, factory_id: int, data: dict):
        q = select(DefectCatalog).where(
            DefectCatalog.id == defect_id, DefectCatalog.factory_id == factory_id,
        )
        result = await db.execute(q)
        defect = result.scalar_one_or_none()
        if not defect:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(defect, k, v)
        await db.commit()
        await db.refresh(defect)
        return defect

    @staticmethod
    async def deactivate(db: AsyncSession, defect_id: int, factory_id: int):
        return await DefectCatalogService.update(db, defect_id, factory_id, {"is_active": False})


class QCTemplateService:
    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> QCTemplate:
        items_data = data.pop("items", [])
        template = QCTemplate(factory_id=factory_id, created_by_id=user_id, **data)
        db.add(template)
        await db.flush()

        for item_data in items_data:
            item = QCTemplateItem(template_id=template.id, **item_data)
            db.add(item)

        await db.commit()
        return await QCTemplateService.get(db, template.id, factory_id)

    @staticmethod
    async def get(db: AsyncSession, template_id: int, factory_id: int):
        q = (
            select(QCTemplate)
            .options(selectinload(QCTemplate.items))
            .where(QCTemplate.id == template_id, QCTemplate.factory_id == factory_id)
        )
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(
        db: AsyncSession, factory_id: int,
        template_type: str | None = None,
        product_id: int | None = None,
        line_id: int | None = None,
    ):
        q = (
            select(QCTemplate)
            .options(selectinload(QCTemplate.items))
            .where(QCTemplate.factory_id == factory_id, QCTemplate.is_active == True)
        )
        if template_type:
            q = q.where(func.lower(QCTemplate.template_type) == template_type.lower())
        if product_id:
            q = q.where(
                (QCTemplate.product_id == product_id) | (QCTemplate.product_id.is_(None))
            )
        if line_id:
            q = q.where(
                (QCTemplate.production_line_id == line_id) | (QCTemplate.production_line_id.is_(None))
            )
        q = q.order_by(QCTemplate.name)
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def clone(db: AsyncSession, template_id: int, factory_id: int, user_id: int):
        original = await QCTemplateService.get(db, template_id, factory_id)
        if not original:
            return None
        data = {
            "name": f"{original.name} (Copy)",
            "template_type": str(original.template_type).lower() if original.template_type else original.template_type,
            "version": "1.0",
            "estimated_time_min": original.estimated_time_min,
            "description": original.description,
            "pass_threshold_pct": original.pass_threshold_pct,
            "critical_items_must_pass": original.critical_items_must_pass,
            "product_id": original.product_id,
            "production_line_id": original.production_line_id,
            "work_center_id": original.work_center_id,
            "items": [
                {
                    "item_order": item.item_order,
                    "category": item.category,
                    "check_type": str(item.check_type).lower() if item.check_type else item.check_type,
                    "description": item.description,
                    "specification": item.specification,
                    "lower_limit": item.lower_limit,
                    "upper_limit": item.upper_limit,
                    "unit": item.unit,
                    "is_critical": item.is_critical,
                    "is_mandatory": item.is_mandatory,
                }
                for item in original.items
            ],
        }
        return await QCTemplateService.create(db, factory_id, user_id, data)


class QCRecordService:
    @staticmethod
    async def start_check(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> QCRecord:
        record = QCRecord(
            factory_id=factory_id,
            performed_by_id=user_id,
            started_at=datetime.now(timezone.utc),
            **data,
        )
        db.add(record)
        await db.commit()
        # Re-fetch with eager loading to avoid MissingGreenlet on results relationship
        q = (
            select(QCRecord)
            .options(selectinload(QCRecord.results))
            .where(QCRecord.id == record.id)
        )
        result = await db.execute(q)
        return result.scalar_one()

    @staticmethod
    async def get(db: AsyncSession, record_id: int, factory_id: int):
        q = (
            select(QCRecord)
            .options(selectinload(QCRecord.results))
            .where(QCRecord.id == record_id, QCRecord.factory_id == factory_id)
        )
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(
        db: AsyncSession, factory_id: int,
        check_type: str | None = None,
        order_id: int | None = None,
        line_id: int | None = None,
        days: int = 30,
    ):
        q = (
            select(QCRecord)
            .options(selectinload(QCRecord.results))
            .where(QCRecord.factory_id == factory_id)
        )
        if check_type:
            q = q.where(func.lower(QCRecord.check_type) == check_type.lower())
        if order_id:
            q = q.where(QCRecord.production_order_id == order_id)
        if line_id:
            q = q.where(QCRecord.production_line_id == line_id)
        q = q.order_by(desc(QCRecord.started_at)).limit(100)
        result = await db.execute(q)
        return result.scalars().unique().all()

    @staticmethod
    async def submit_results(db: AsyncSession, record_id: int, factory_id: int, results: list[dict]):
        record = await QCRecordService.get(db, record_id, factory_id)
        if not record:
            return None

        for r in results:
            check_result = QCCheckResultRecord(qc_record_id=record_id, **r)
            db.add(check_result)

        await db.commit()
        return await QCRecordService.get(db, record_id, factory_id)

    @staticmethod
    async def complete_check(db: AsyncSession, record_id: int, factory_id: int) -> QCRecord | None:
        """
        The core QC engine:
        1. Calculate overall score
        2. Check critical failures
        3. Set pass/fail status
        4. Auto-trigger Andon if failed
        5. Place QC hold on PO if critical
        """
        record = await QCRecordService.get(db, record_id, factory_id)
        if not record:
            return None

        # Load template to check thresholds
        tq = (
            select(QCTemplate)
            .options(selectinload(QCTemplate.items))
            .where(QCTemplate.id == record.template_id)
        )
        tr = await db.execute(tq)
        template = tr.scalar_one_or_none()

        # Calculate score
        total_items = len(record.results)
        if total_items == 0:
            record.status = "voided"
            record.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(record)
            return record

        passed_items = sum(1 for r in record.results if str(r.result).lower() == "pass")
        failed_items = sum(1 for r in record.results if str(r.result).lower() == "fail")
        score_pct = (passed_items / total_items) * 100
        record.overall_score_pct = round(score_pct, 1)
        record.completed_at = datetime.now(timezone.utc)

        # Check critical failures
        critical_failed = False
        if template and template.items:
            critical_item_ids = {i.id for i in template.items if i.is_critical}
            for r in record.results:
                if r.template_item_id in critical_item_ids and str(r.result).lower() == "fail":
                    critical_failed = True
                    break

        # Determine status
        threshold = template.pass_threshold_pct if template else 100.0
        must_pass_critical = template.critical_items_must_pass if template else True

        if critical_failed and must_pass_critical:
            record.status = "failed"
        elif score_pct < threshold:
            record.status = "failed"
        elif failed_items > 0:
            record.status = "passed_with_deviations"
        else:
            record.status = "passed"

        # If FAILED → Auto-Linked Quality Loop (Andon + NCR + Notification)
        if record.status == "failed":
            andon_status = "red" if critical_failed else "yellow"
            check_type_str = str(record.check_type).lower() if record.check_type else "qc_check"
            template_name = template.name if template else "QC Check"

            # 1. Auto-trigger Andon
            andon = AndonEvent(
                factory_id=factory_id,
                production_line_id=record.production_line_id,
                status=andon_status,
                reason=f"QC: {template_name}",
                description=f"QC Check Failed: {template_name} — {failed_items} items failed ({score_pct:.0f}% score)",
                source="qc_check",
                qc_record_id=record.id,
                trigger_type=f"{check_type_str}_fail",
            )
            db.add(andon)
            await db.flush()

            record.andon_triggered = True
            record.andon_event_id = andon.id

            # 2. Auto-create NCR (one transaction)
            ncr_number = await NCRService._generate_ncr_number(db, factory_id)
            ncr = NonConformanceReport(
                factory_id=factory_id,
                production_line_id=record.production_line_id,
                production_order_id=record.production_order_id,
                qc_record_id=record.id,
                raised_by_id=record.performed_by_id,
                ncr_number=ncr_number,
                title=f"QC Failure: {template_name}",
                description=f"Auto-generated NCR from {check_type_str} failure. "
                            f"{failed_items} item(s) failed out of {total_items} "
                            f"(score: {score_pct:.0f}%).",
                severity="critical" if critical_failed else "major",
                status="open",
            )
            # Auto-assign NCR to line supervisor (Automation #11)
            from app.models.user import User
            supervisor_q = select(User).where(
                User.factory_id == factory_id,
                User.role == "supervisor",
                User.is_active == True,
            ).limit(1)
            supervisor_r = await db.execute(supervisor_q)
            supervisor = supervisor_r.scalar_one_or_none()
            if supervisor:
                ncr.assigned_to_id = supervisor.id
            db.add(ncr)
            await db.flush()

            # 3. Auto-create notifications
            try:
                from app.services.notification_service import notify_qc_fail
                # Get line name for notification
                from app.models.factory import ProductionLine
                line_q = select(ProductionLine.name).where(
                    ProductionLine.id == record.production_line_id
                )
                line_r = await db.execute(line_q)
                line_name = line_r.scalar() or "Unknown Line"

                await notify_qc_fail(
                    db,
                    factory_id=factory_id,
                    qc_record_id=record.id,
                    line_name=line_name,
                    check_type=check_type_str,
                )
            except Exception:
                pass  # Don't fail the QC check if notifications fail

            # 4. Place QC hold on PO if linked
            if record.production_order_id:
                po_q = select(ProductionOrder).where(ProductionOrder.id == record.production_order_id)
                po_r = await db.execute(po_q)
                po = po_r.scalar_one_or_none()
                if po:
                    po.qc_hold = True
                    po.qc_hold_reason = f"QC {check_type_str} failed: {template_name}"
                    po.status = "on_hold"
                    record.hold_placed = True

        await db.commit()
        await db.refresh(record)
        return record


class NCRService:
    @staticmethod
    async def _generate_ncr_number(db: AsyncSession, factory_id: int) -> str:
        year = datetime.now(timezone.utc).year
        q = select(func.count(NonConformanceReport.id)).where(
            NonConformanceReport.factory_id == factory_id,
        )
        result = await db.execute(q)
        count = result.scalar() or 0
        return f"NCR-{year}-{count + 1:04d}"

    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> NonConformanceReport:
        ncr = NonConformanceReport(
            factory_id=factory_id,
            raised_by_id=user_id,
            ncr_number=await NCRService._generate_ncr_number(db, factory_id),
            **data,
        )
        db.add(ncr)
        await db.commit()
        await db.refresh(ncr)
        return ncr

    @staticmethod
    async def get(db: AsyncSession, ncr_id: int, factory_id: int):
        q = select(NonConformanceReport).where(
            NonConformanceReport.id == ncr_id, NonConformanceReport.factory_id == factory_id,
        )
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(db: AsyncSession, factory_id: int, status: str | None = None, severity: str | None = None):
        q = select(NonConformanceReport).where(NonConformanceReport.factory_id == factory_id)
        if status:
            q = q.where(func.lower(NonConformanceReport.status) == status.lower())
        if severity:
            q = q.where(func.lower(NonConformanceReport.severity) == severity.lower())
        q = q.order_by(desc(NonConformanceReport.detected_at))
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def update(db: AsyncSession, ncr_id: int, factory_id: int, user_id: int, data: dict):
        ncr = await NCRService.get(db, ncr_id, factory_id)
        if not ncr:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(ncr, k, v)
        if data.get("status") == "closed":
            ncr.closed_at = datetime.now(timezone.utc)
            ncr.closed_by_id = user_id
        await db.commit()
        await db.refresh(ncr)
        return ncr


class CAPAService:
    @staticmethod
    async def _generate_capa_number(db: AsyncSession, factory_id: int) -> str:
        year = datetime.now(timezone.utc).year
        q = select(func.count(CAPAAction.id)).where(CAPAAction.factory_id == factory_id)
        result = await db.execute(q)
        count = result.scalar() or 0
        return f"CAPA-{year}-{count + 1:04d}"

    @staticmethod
    async def create(db: AsyncSession, factory_id: int, user_id: int, data: dict) -> CAPAAction:
        capa = CAPAAction(
            factory_id=factory_id,
            created_by_id=user_id,
            capa_number=await CAPAService._generate_capa_number(db, factory_id),
            **data,
        )
        db.add(capa)
        await db.commit()
        await db.refresh(capa)
        return capa

    @staticmethod
    async def get(db: AsyncSession, capa_id: int, factory_id: int):
        q = select(CAPAAction).where(CAPAAction.id == capa_id, CAPAAction.factory_id == factory_id)
        result = await db.execute(q)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(db: AsyncSession, factory_id: int, status: str | None = None):
        q = select(CAPAAction).where(CAPAAction.factory_id == factory_id)
        if status:
            q = q.where(func.lower(CAPAAction.status) == status.lower())
        q = q.order_by(desc(CAPAAction.created_at))
        result = await db.execute(q)
        return result.scalars().all()

    @staticmethod
    async def update(db: AsyncSession, capa_id: int, factory_id: int, data: dict):
        capa = await CAPAService.get(db, capa_id, factory_id)
        if not capa:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(capa, k, v)
        if data.get("status") == "implemented":
            capa.implemented_at = datetime.now(timezone.utc)
        elif data.get("status") == "verified":
            capa.verified_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(capa)
        return capa

    @staticmethod
    async def verify(db: AsyncSession, capa_id: int, factory_id: int, user_id: int, effectiveness: str):
        capa = await CAPAService.get(db, capa_id, factory_id)
        if not capa:
            return None
        capa.status = "verified"
        capa.verified_at = datetime.now(timezone.utc)
        capa.verified_by_id = user_id
        capa.effectiveness_result = effectiveness
        await db.commit()
        await db.refresh(capa)
        return capa
