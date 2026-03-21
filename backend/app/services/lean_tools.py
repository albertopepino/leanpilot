from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.models.lean import (
    FiveWhyAnalysis, FiveWhyStep, FiveWhyStatus,
    IshikawaAnalysis, IshikawaCause,
    KaizenItem, KaizenStatus, KaizenPriority,
    SMEDRecord, SMEDStep,
)
from app.models.production import DowntimeEvent, ScrapRecord


class FiveWhyService:
    """5 WHY analysis - core Lean tool, no AI."""

    @staticmethod
    async def create(
        db: AsyncSession,
        factory_id: int,
        user_id: int,
        data: dict,
    ) -> FiveWhyAnalysis:
        analysis = FiveWhyAnalysis(
            factory_id=factory_id,
            production_line_id=data.get("production_line_id"),
            created_by_id=user_id,
            title=data["title"],
            problem_statement=data["problem_statement"],
            countermeasure=data.get("countermeasure"),
            responsible=data.get("responsible"),
            due_date=data.get("due_date"),
        )
        db.add(analysis)
        await db.flush()

        for step_data in data.get("steps", []):
            step = FiveWhyStep(
                analysis_id=analysis.id,
                step_number=step_data["step_number"],
                why_question=step_data["why_question"],
                answer=step_data["answer"],
            )
            db.add(step)

        if len(data.get("steps", [])) >= 5:
            analysis.status = "completed"
            analysis.root_cause = data["steps"][-1]["answer"]

        await db.flush()
        return analysis

    @staticmethod
    async def list_by_factory(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(FiveWhyAnalysis)
            .options(selectinload(FiveWhyAnalysis.steps))
            .where(FiveWhyAnalysis.factory_id == factory_id)
            .order_by(FiveWhyAnalysis.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().unique().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, analysis_id: int, factory_id: int | None = None):
        result = await db.execute(
            select(FiveWhyAnalysis)
            .options(selectinload(FiveWhyAnalysis.steps))
            .where(FiveWhyAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis and factory_id is not None and analysis.factory_id != factory_id:
            return None
        return analysis

    @staticmethod
    async def delete(db: AsyncSession, analysis_id: int, factory_id: int | None = None):
        result = await db.execute(
            select(FiveWhyAnalysis).where(FiveWhyAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="5 Why analysis not found")
        if factory_id is not None and analysis.factory_id != factory_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Analysis does not belong to your factory")
        # Delete steps first
        steps_result = await db.execute(
            select(FiveWhyStep).where(FiveWhyStep.analysis_id == analysis_id)
        )
        for step in steps_result.scalars().all():
            await db.delete(step)
        await db.delete(analysis)
        await db.flush()


class IshikawaService:
    """Ishikawa (fishbone) diagram - core Lean tool, no AI."""

    @staticmethod
    async def create(
        db: AsyncSession,
        factory_id: int,
        user_id: int,
        data: dict,
    ) -> IshikawaAnalysis:
        analysis = IshikawaAnalysis(
            factory_id=factory_id,
            production_line_id=data.get("production_line_id"),
            created_by_id=user_id,
            title=data["title"],
            effect=data["effect"],
            conclusion=data.get("conclusion"),
        )
        db.add(analysis)
        await db.flush()

        for cause_data in data.get("causes", []):
            cause = IshikawaCause(
                analysis_id=analysis.id,
                category=cause_data["category"],
                cause=cause_data["cause"],
                sub_cause=cause_data.get("sub_cause"),
                is_root_cause=cause_data.get("is_root_cause", False),
            )
            db.add(cause)

        await db.flush()
        return analysis

    @staticmethod
    async def list_by_factory(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(IshikawaAnalysis)
            .options(selectinload(IshikawaAnalysis.causes))
            .where(IshikawaAnalysis.factory_id == factory_id)
            .order_by(IshikawaAnalysis.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().unique().all()

    @staticmethod
    async def get_by_id(db: AsyncSession, analysis_id: int, factory_id: int | None = None):
        result = await db.execute(
            select(IshikawaAnalysis)
            .options(selectinload(IshikawaAnalysis.causes))
            .where(IshikawaAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if analysis and factory_id is not None and analysis.factory_id != factory_id:
            return None
        return analysis

    @staticmethod
    async def delete(db: AsyncSession, analysis_id: int, factory_id: int | None = None):
        result = await db.execute(
            select(IshikawaAnalysis).where(IshikawaAnalysis.id == analysis_id)
        )
        analysis = result.scalar_one_or_none()
        if not analysis:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Ishikawa analysis not found")
        if factory_id is not None and analysis.factory_id != factory_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Analysis does not belong to your factory")
        # Delete causes first
        causes_result = await db.execute(
            select(IshikawaCause).where(IshikawaCause.analysis_id == analysis_id)
        )
        for cause in causes_result.scalars().all():
            await db.delete(cause)
        await db.delete(analysis)
        await db.flush()


class KaizenService:
    """Kaizen board - core Lean tool, no AI."""

    @staticmethod
    async def create(
        db: AsyncSession,
        factory_id: int,
        user_id: int,
        data: dict,
    ) -> KaizenItem:
        item = KaizenItem(
            factory_id=factory_id,
            production_line_id=data.get("production_line_id"),
            created_by_id=user_id,
            assigned_to_id=data.get("assigned_to_id"),
            title=data["title"],
            description=data["description"],
            category=data.get("category"),
            priority=data.get("priority", "medium"),
            expected_impact=data.get("expected_impact"),
            expected_savings_eur=data.get("expected_savings_eur"),
            target_date=data.get("target_date"),
            lsw_id=data.get("lsw_id"),
            countermeasure=data.get("countermeasure"),
        )
        db.add(item)
        await db.flush()
        return item

    @staticmethod
    async def list_by_factory(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(KaizenItem)
            .where(KaizenItem.factory_id == factory_id)
            .order_by(KaizenItem.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    @staticmethod
    async def update_status(
        db: AsyncSession,
        kaizen_id: int,
        new_status: str,
        actual_savings: float | None = None,
        factory_id: int | None = None,
    ) -> KaizenItem:
        result = await db.execute(select(KaizenItem).where(KaizenItem.id == kaizen_id))
        item = result.scalar_one_or_none()
        if not item:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Kaizen item not found")
        if factory_id is not None and item.factory_id != factory_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Kaizen item does not belong to your factory")
        # Enforce LSW link for standardization
        normalized = new_status.lower() if new_status else ""
        if normalized == "standardized" and not item.lsw_id:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="Cannot standardize without linking to a Leader Standard Work template. Please link an LSW first.",
            )

        item.status = new_status.lower() if new_status else new_status
        if new_status and new_status.lower() == "completed":
            item.completion_date = datetime.now(timezone.utc)
        if actual_savings is not None:
            item.actual_savings_eur = actual_savings

        # Auto-update LSW when kaizen is verified or standardized
        if normalized in ("verified", "standardized") and item.lsw_id:
            await KaizenService._update_linked_lsw(db, item)

        await db.flush()
        return item

    @staticmethod
    async def _update_linked_lsw(db: AsyncSession, item: KaizenItem) -> None:
        """Append kaizen countermeasure as a new task in the linked LSW template."""
        from app.models.leader_standard_work import LeaderStandardWork
        from app.models.notification import Notification
        import structlog

        try:
            lsw_result = await db.execute(
                select(LeaderStandardWork).where(LeaderStandardWork.id == item.lsw_id)
            )
            lsw = lsw_result.scalar_one_or_none()
            if not lsw:
                return

            # Build new task from kaizen countermeasure
            countermeasure_text = item.countermeasure or item.description or item.title
            existing_tasks = list(lsw.tasks or [])
            new_order = max((t.get("order", 0) for t in existing_tasks), default=0) + 1
            new_task = {
                "order": new_order,
                "description": f"[Kaizen #{item.id}] {countermeasure_text}",
                "time_min": 5,
                "category": item.category or "improvement",
                "source_kaizen_id": item.id,
            }
            existing_tasks.append(new_task)
            lsw.tasks = existing_tasks

            # Create notification for the LSW creator
            notification = Notification(
                factory_id=item.factory_id,
                user_id=lsw.created_by_id,
                notification_type="general",
                priority="medium",
                title=f"Standard work updated from Kaizen #{item.id}",
                message=f'Kaizen "{item.title}" has been {item.status}. '
                        f"A new task was added to LSW \"{lsw.title}\".",
                link="/lean/kaizen?tab=lsw",
                source_type="kaizen",
                source_id=item.id,
            )
            db.add(notification)
        except Exception as e:
            structlog.get_logger().warning("lsw_auto_update_failed", kaizen_id=item.id, error=str(e))

    @staticmethod
    def _normalize(val):
        """Normalize an enum or string value to lowercase."""
        if val is None:
            return val
        if hasattr(val, "value"):
            return val.value
        return str(val).lower()

    @staticmethod
    def _serialize_kaizen(item: KaizenItem) -> dict:
        """Convert a KaizenItem ORM object to a plain dict for JSON serialization."""
        return {
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "category": item.category,
            "priority": KaizenService._normalize(item.priority),
            "status": KaizenService._normalize(item.status),
            "expected_impact": item.expected_impact,
            "expected_savings_eur": item.expected_savings_eur,
            "actual_savings_eur": item.actual_savings_eur,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "target_date": item.target_date.isoformat() if item.target_date else None,
            "completion_date": item.completion_date.isoformat() if item.completion_date else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
            "factory_id": item.factory_id,
            "created_by_id": item.created_by_id,
            "assigned_to_id": item.assigned_to_id,
            "production_line_id": item.production_line_id,
            "ai_generated": item.ai_generated,
            "ai_confidence": item.ai_confidence,
            "lsw_id": item.lsw_id,
            "pareto_rank": item.pareto_rank,
            "countermeasure": item.countermeasure,
        }

    @staticmethod
    async def get_board(db: AsyncSession, factory_id: int) -> dict:
        result = await db.execute(
            select(KaizenItem)
            .where(KaizenItem.factory_id == factory_id)
            .order_by(KaizenItem.created_at.desc())
        )
        items = result.scalars().all()
        board = {status.value: [] for status in KaizenStatus}
        for item in items:
            key = KaizenService._normalize(item.status)
            if key not in board:
                board[key] = []
            board[key].append(KaizenService._serialize_kaizen(item))
        return board

    @staticmethod
    async def get_savings_summary(db: AsyncSession, factory_id: int) -> dict:
        result = await db.execute(
            select(
                func.sum(KaizenItem.expected_savings_eur).label("expected"),
                func.sum(KaizenItem.actual_savings_eur).label("actual"),
                func.count(KaizenItem.id).label("total"),
            )
            .where(KaizenItem.factory_id == factory_id)
            .where(func.lower(KaizenItem.status).in_(["completed", "verified"]))
        )
        row = result.one()

        # Per-category breakdown
        cat_result = await db.execute(
            select(
                KaizenItem.category,
                func.sum(KaizenItem.expected_savings_eur).label("expected"),
                func.sum(KaizenItem.actual_savings_eur).label("actual"),
            )
            .where(KaizenItem.factory_id == factory_id)
            .where(func.lower(KaizenItem.status).in_(["completed", "verified"]))
            .group_by(KaizenItem.category)
        )
        by_category = {}
        for cat_row in cat_result.all():
            cat_name = cat_row.category or "other"
            by_category[cat_name] = {
                "expected": round(cat_row.expected or 0, 2),
                "actual": round(cat_row.actual or 0, 2),
            }

        return {
            "total_expected": round(row.expected or 0, 2),
            "total_actual": round(row.actual or 0, 2),
            "completed_count": row.total or 0,
            "by_category": by_category,
        }


class SMEDService:
    """SMED (Single-Minute Exchange of Die) - core Lean tool, no AI."""

    @staticmethod
    async def list_by_factory(db: AsyncSession, factory_id: int, skip: int = 0, limit: int = 50):
        result = await db.execute(
            select(SMEDRecord)
            .options(selectinload(SMEDRecord.steps))
            .where(SMEDRecord.factory_id == factory_id)
            .order_by(SMEDRecord.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().unique().all()

    @staticmethod
    async def create(
        db: AsyncSession,
        factory_id: int,
        user_id: int,
        data: dict,
    ) -> SMEDRecord:
        record = SMEDRecord(
            factory_id=factory_id,
            production_line_id=data["production_line_id"],
            created_by_id=user_id,
            changeover_name=data["changeover_name"],
            baseline_time_min=data["baseline_time_min"],
            current_time_min=data.get("current_time_min"),
            target_time_min=data.get("target_time_min"),
        )
        db.add(record)
        await db.flush()

        for step_data in data.get("steps", []):
            step = SMEDStep(
                record_id=record.id,
                step_order=step_data["step_order"],
                description=step_data["description"],
                duration_seconds=step_data["duration_seconds"],
                phase=step_data["phase"],
                can_be_externalized=step_data.get("can_be_externalized", False),
                improvement_notes=step_data.get("improvement_notes"),
            )
            db.add(step)

        await db.flush()
        return record

    @staticmethod
    async def get_improvement_potential(db: AsyncSession, record_id: int, factory_id: int | None = None) -> dict:
        if factory_id is not None:
            rec_result = await db.execute(select(SMEDRecord).where(SMEDRecord.id == record_id))
            record = rec_result.scalar_one_or_none()
            if not record or record.factory_id != factory_id:
                from fastapi import HTTPException
                raise HTTPException(status_code=403, detail="SMED record does not belong to your factory")
        result = await db.execute(
            select(SMEDStep)
            .where(SMEDStep.record_id == record_id)
            .order_by(SMEDStep.step_order)
        )
        steps = result.scalars().all()

        internal_time = sum(s.duration_seconds for s in steps if str(s.phase).lower() == "internal")
        external_time = sum(s.duration_seconds for s in steps if str(s.phase).lower() == "external")
        externalizable = sum(
            s.duration_seconds for s in steps
            if str(s.phase).lower() == "internal" and s.can_be_externalized
        )

        return {
            "total_internal_sec": internal_time,
            "total_external_sec": external_time,
            "externalizable_sec": externalizable,
            "potential_reduction_pct": round(
                (externalizable / internal_time * 100) if internal_time > 0 else 0, 1
            ),
            "step_count": len(steps),
        }
