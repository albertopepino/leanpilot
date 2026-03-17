from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone

from app.models.production import ProductionRecord, DowntimeEvent
from app.models.lean import OEERecord


class OEECalculator:
    """Core OEE calculation engine. No AI required."""

    @staticmethod
    def calculate_oee(
        planned_time_min: float,
        run_time_min: float,
        total_pieces: int,
        good_pieces: int,
        ideal_cycle_time_sec: float,
    ) -> dict:
        if planned_time_min <= 0:
            return {"availability": 0, "performance": 0, "quality": 0, "oee": 0}

        availability = (run_time_min / planned_time_min) * 100

        max_possible_pieces = (run_time_min * 60) / ideal_cycle_time_sec if ideal_cycle_time_sec > 0 else 0
        performance = (total_pieces / max_possible_pieces * 100) if max_possible_pieces > 0 else 0

        quality = (good_pieces / total_pieces * 100) if total_pieces > 0 else 0

        oee = (availability * performance * quality) / 10000

        return {
            "availability": round(availability, 2),
            "performance": round(performance, 2),
            "quality": round(quality, 2),
            "oee": round(oee, 2),
        }

    @staticmethod
    async def calculate_and_store(
        db: AsyncSession,
        production_record: ProductionRecord,
    ) -> OEERecord:
        result = OEECalculator.calculate_oee(
            planned_time_min=production_record.planned_production_time_min,
            run_time_min=production_record.actual_run_time_min,
            total_pieces=production_record.total_pieces,
            good_pieces=production_record.good_pieces,
            ideal_cycle_time_sec=production_record.ideal_cycle_time_sec,
        )

        downtime_min = production_record.planned_production_time_min - production_record.actual_run_time_min

        oee_record = OEERecord(
            production_line_id=production_record.production_line_id,
            production_record_id=production_record.id,
            date=production_record.date,
            availability=result["availability"],
            performance=result["performance"],
            quality=result["quality"],
            oee=result["oee"],
            planned_time_min=production_record.planned_production_time_min,
            run_time_min=production_record.actual_run_time_min,
            total_pieces=production_record.total_pieces,
            good_pieces=production_record.good_pieces,
            downtime_min=downtime_min,
        )

        db.add(oee_record)
        await db.flush()
        return oee_record

    @staticmethod
    async def get_line_summary(
        db: AsyncSession,
        line_id: int,
        days: int = 30,
    ) -> dict:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await db.execute(
            select(
                func.avg(OEERecord.oee).label("avg_oee"),
                func.avg(OEERecord.availability).label("avg_availability"),
                func.avg(OEERecord.performance).label("avg_performance"),
                func.avg(OEERecord.quality).label("avg_quality"),
                func.count(OEERecord.id).label("record_count"),
                func.sum(OEERecord.downtime_min).label("total_downtime"),
            )
            .where(OEERecord.production_line_id == line_id)
            .where(OEERecord.date >= since)
        )
        row = result.one()
        return {
            "avg_oee": round(row.avg_oee or 0, 2),
            "avg_availability": round(row.avg_availability or 0, 2),
            "avg_performance": round(row.avg_performance or 0, 2),
            "avg_quality": round(row.avg_quality or 0, 2),
            "record_count": row.record_count or 0,
            "total_downtime_min": round(row.total_downtime or 0, 2),
            "period_days": days,
        }

    @staticmethod
    async def get_trend(
        db: AsyncSession,
        line_id: int,
        days: int = 30,
    ) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        result = await db.execute(
            select(OEERecord)
            .where(OEERecord.production_line_id == line_id)
            .where(OEERecord.date >= since)
            .order_by(OEERecord.date)
        )
        records = result.scalars().all()
        return [
            {
                "date": r.date.isoformat(),
                "oee": r.oee,
                "availability": r.availability,
                "performance": r.performance,
                "quality": r.quality,
            }
            for r in records
        ]
