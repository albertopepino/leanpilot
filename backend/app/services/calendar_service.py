"""
Master Calendar Service
───────────────────────
Aggregates events from 8 tables into a unified calendar feed.
All queries run in parallel via asyncio.gather.
"""

import asyncio
from datetime import datetime, date, time, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.qc import CAPAAction
from app.models.lean import KaizenItem
from app.models.lean_advanced import (
    TPMEquipment, TPMMaintenanceRecord,
    SixSAudit, GembaWalk,
    CILTExecution, CILTStandard,
)
from app.models.manufacturing import ProductionOrder
from app.models.factory import ProductionLine
from app.schemas.calendar import CalendarEvent, CalendarEventSource


class CalendarService:

    @staticmethod
    async def get_events(
        db: AsyncSession,
        factory_id: int,
        dt_from: datetime,
        dt_to: datetime,
        sources: list[str] | None = None,
        line_id: int | None = None,
    ) -> list[CalendarEvent]:
        """Fetch calendar events from all sources in parallel."""

        all_sources = {s.value for s in CalendarEventSource}
        wanted = set(sources) & all_sources if sources else all_sources

        tasks: list[asyncio.Task] = []

        if "capa" in wanted:
            tasks.append(_fetch_capa(db, factory_id, dt_from, dt_to, line_id))
        if "kaizen" in wanted:
            tasks.append(_fetch_kaizen(db, factory_id, dt_from, dt_to, line_id))
        if "tpm_equipment" in wanted:
            tasks.append(_fetch_tpm_equipment(db, factory_id, dt_from, dt_to, line_id))
        if "tpm_maintenance" in wanted:
            tasks.append(_fetch_tpm_maintenance(db, factory_id, dt_from, dt_to, line_id))
        if "six_s" in wanted:
            tasks.append(_fetch_six_s(db, factory_id, dt_from, dt_to, line_id))
        if "gemba" in wanted:
            tasks.append(_fetch_gemba(db, factory_id, dt_from, dt_to))
        if "production_order_start" in wanted or "production_order_end" in wanted:
            tasks.append(_fetch_production_orders(db, factory_id, dt_from, dt_to, line_id, wanted))
        if "cilt" in wanted:
            tasks.append(_fetch_cilt(db, factory_id, dt_from, dt_to, line_id))

        if not tasks:
            return []

        results = await asyncio.gather(*tasks)
        events: list[CalendarEvent] = []
        for result_list in results:
            events.extend(result_list)

        events.sort(key=lambda e: e.date)
        return events


# ─── Private query helpers ────────────────────────────────────────────────────


async def _fetch_capa(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    stmt = (
        select(CAPAAction, ProductionLine.name.label("line_name"))
        .outerjoin(ProductionLine, CAPAAction.production_line_id == ProductionLine.id)
        .where(
            CAPAAction.factory_id == factory_id,
            CAPAAction.due_date >= dt_from,
            CAPAAction.due_date <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(CAPAAction.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.CAPAAction.id,
            source=CalendarEventSource.capa,
            title=f"CAPA: {r.CAPAAction.title}",
            date=r.CAPAAction.due_date,
            status=r.CAPAAction.status,
            priority=r.CAPAAction.priority,
            production_line_id=r.CAPAAction.production_line_id,
            production_line_name=r.line_name,
            source_id=r.CAPAAction.id,
            view_key="capa",
        )
        for r in rows
    ]


async def _fetch_kaizen(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    stmt = (
        select(KaizenItem, ProductionLine.name.label("line_name"))
        .outerjoin(ProductionLine, KaizenItem.production_line_id == ProductionLine.id)
        .where(
            KaizenItem.factory_id == factory_id,
            KaizenItem.target_date >= dt_from,
            KaizenItem.target_date <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(KaizenItem.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.KaizenItem.id,
            source=CalendarEventSource.kaizen,
            title=f"Kaizen: {r.KaizenItem.title}",
            date=r.KaizenItem.target_date,
            status=r.KaizenItem.status,
            priority=r.KaizenItem.priority,
            production_line_id=r.KaizenItem.production_line_id,
            production_line_name=r.line_name,
            source_id=r.KaizenItem.id,
            view_key="kaizen",
        )
        for r in rows
    ]


async def _fetch_tpm_equipment(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    stmt = (
        select(TPMEquipment, ProductionLine.name.label("line_name"))
        .outerjoin(ProductionLine, TPMEquipment.production_line_id == ProductionLine.id)
        .where(
            TPMEquipment.factory_id == factory_id,
            TPMEquipment.next_planned_maintenance >= dt_from,
            TPMEquipment.next_planned_maintenance <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(TPMEquipment.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.TPMEquipment.id,
            source=CalendarEventSource.tpm_equipment,
            title=f"TPM Planned: {r.TPMEquipment.name}",
            date=r.TPMEquipment.next_planned_maintenance,
            status=None,
            priority=r.TPMEquipment.criticality,
            production_line_id=r.TPMEquipment.production_line_id,
            production_line_name=r.line_name,
            source_id=r.TPMEquipment.id,
            view_key="tpm",
        )
        for r in rows
    ]


async def _fetch_tpm_maintenance(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    # TPMMaintenanceRecord has no factory_id — join via TPMEquipment
    stmt = (
        select(
            TPMMaintenanceRecord,
            TPMEquipment.name.label("equip_name"),
            TPMEquipment.production_line_id.label("pl_id"),
            ProductionLine.name.label("line_name"),
        )
        .join(TPMEquipment, TPMMaintenanceRecord.equipment_id == TPMEquipment.id)
        .outerjoin(ProductionLine, TPMEquipment.production_line_id == ProductionLine.id)
        .where(
            TPMEquipment.factory_id == factory_id,
            TPMMaintenanceRecord.date_performed >= dt_from,
            TPMMaintenanceRecord.date_performed <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(TPMEquipment.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.TPMMaintenanceRecord.id,
            source=CalendarEventSource.tpm_maintenance,
            title=f"TPM Done: {r.equip_name}",
            date=r.TPMMaintenanceRecord.date_performed,
            status=r.TPMMaintenanceRecord.maintenance_type,
            production_line_id=r.pl_id,
            production_line_name=r.line_name,
            source_id=r.TPMMaintenanceRecord.id,
            view_key="tpm",
        )
        for r in rows
    ]


async def _fetch_six_s(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    stmt = (
        select(SixSAudit, ProductionLine.name.label("line_name"))
        .outerjoin(ProductionLine, SixSAudit.production_line_id == ProductionLine.id)
        .where(
            SixSAudit.factory_id == factory_id,
            SixSAudit.audit_date >= dt_from,
            SixSAudit.audit_date <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(SixSAudit.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.SixSAudit.id,
            source=CalendarEventSource.six_s,
            title=f"6S Audit: {r.SixSAudit.area_name}",
            date=r.SixSAudit.audit_date,
            status=None,
            production_line_id=r.SixSAudit.production_line_id,
            production_line_name=r.line_name,
            source_id=r.SixSAudit.id,
            view_key="six-s",
        )
        for r in rows
    ]


async def _fetch_gemba(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime
) -> list[CalendarEvent]:
    # GembaWalk has no production_line_id — no line filter possible
    stmt = select(GembaWalk).where(
        GembaWalk.factory_id == factory_id,
        GembaWalk.walk_date >= dt_from,
        GembaWalk.walk_date <= dt_to,
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        CalendarEvent(
            id=w.id,
            source=CalendarEventSource.gemba,
            title=f"Gemba Walk: {w.area}",
            date=w.walk_date,
            status=None,
            source_id=w.id,
            view_key="gemba",
        )
        for w in rows
    ]


async def _fetch_production_orders(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime,
    line_id: int | None, wanted: set[str],
) -> list[CalendarEvent]:
    # Fetch orders whose planned_start OR planned_end falls in range
    stmt = (
        select(ProductionOrder, ProductionLine.name.label("line_name"))
        .outerjoin(ProductionLine, ProductionOrder.production_line_id == ProductionLine.id)
        .where(ProductionOrder.factory_id == factory_id)
    )
    if line_id:
        stmt = stmt.where(ProductionOrder.production_line_id == line_id)

    # Include orders that overlap the date range via start or end
    from sqlalchemy import or_
    conditions = []
    if "production_order_start" in wanted:
        conditions.append(
            (ProductionOrder.planned_start >= dt_from) & (ProductionOrder.planned_start <= dt_to)
        )
    if "production_order_end" in wanted:
        conditions.append(
            (ProductionOrder.planned_end >= dt_from) & (ProductionOrder.planned_end <= dt_to)
        )
    if conditions:
        stmt = stmt.where(or_(*conditions))

    rows = (await db.execute(stmt)).all()
    events: list[CalendarEvent] = []
    for r in rows:
        po = r.ProductionOrder
        if "production_order_start" in wanted and po.planned_start and dt_from <= po.planned_start <= dt_to:
            events.append(CalendarEvent(
                id=po.id,
                source=CalendarEventSource.production_order_start,
                title=f"PO Start: {po.order_number}",
                date=po.planned_start,
                end_date=po.planned_end,
                status=po.status,
                production_line_id=po.production_line_id,
                production_line_name=r.line_name,
                source_id=po.id,
                view_key="production-orders",
            ))
        if "production_order_end" in wanted and po.planned_end and dt_from <= po.planned_end <= dt_to:
            events.append(CalendarEvent(
                id=po.id,
                source=CalendarEventSource.production_order_end,
                title=f"PO End: {po.order_number}",
                date=po.planned_end,
                end_date=None,
                status=po.status,
                production_line_id=po.production_line_id,
                production_line_name=r.line_name,
                source_id=po.id,
                view_key="production-orders",
            ))
    return events


async def _fetch_cilt(
    db: AsyncSession, factory_id: int, dt_from: datetime, dt_to: datetime, line_id: int | None
) -> list[CalendarEvent]:
    # CILTExecution has no factory_id — join via CILTStandard
    stmt = (
        select(
            CILTExecution,
            CILTStandard.name.label("std_name"),
            CILTStandard.production_line_id.label("pl_id"),
            ProductionLine.name.label("line_name"),
        )
        .join(CILTStandard, CILTExecution.standard_id == CILTStandard.id)
        .outerjoin(ProductionLine, CILTStandard.production_line_id == ProductionLine.id)
        .where(
            CILTStandard.factory_id == factory_id,
            CILTExecution.execution_date >= dt_from,
            CILTExecution.execution_date <= dt_to,
        )
    )
    if line_id:
        stmt = stmt.where(CILTStandard.production_line_id == line_id)
    rows = (await db.execute(stmt)).all()
    return [
        CalendarEvent(
            id=r.CILTExecution.id,
            source=CalendarEventSource.cilt,
            title=f"CILT: {r.std_name}",
            date=r.CILTExecution.execution_date,
            status="ok" if r.CILTExecution.all_ok else "nok",
            production_line_id=r.pl_id,
            production_line_name=r.line_name,
            source_id=r.CILTExecution.id,
            view_key="cilt",
        )
        for r in rows
    ]
