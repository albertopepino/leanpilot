from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.waste import WasteEvent
from app.models.factory import ProductionLine
from app.schemas.waste import (
    WasteEventCreate, WasteEventUpdate, WasteEventResponse,
    WasteSummaryResponse, WasteSummaryByType, WasteSummaryByLine,
)

router = APIRouter(prefix="/waste", tags=["waste"])


# ─── POST /waste/ — log a new waste event ─────────────────────────────────

@router.post("/", response_model=WasteEventResponse)
async def create_waste_event(
    data: WasteEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # IDOR check: validate production_line_id belongs to user's factory
    if data.production_line_id is not None:
        line_result = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == data.production_line_id,
                ProductionLine.factory_id == fid,
            )
        )
        if not line_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")

    event = WasteEvent(
        factory_id=fid,
        reported_by=user.id,
        **data.model_dump(),
    )
    db.add(event)
    await db.flush()
    await db.commit()
    await db.refresh(event)
    return event


# ─── GET /waste/ — list waste events with filters ─────────────────────────

@router.get("/", response_model=list[WasteEventResponse])
async def list_waste_events(
    line_id: int | None = Query(None, description="Filter by production line"),
    waste_type: str | None = Query(None, description="Filter by waste type (e.g. defects, motion)"),
    severity: str | None = Query(None, description="Filter by severity"),
    status: str | None = Query(None, description="Filter by status"),
    date_from: date | None = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    q = select(WasteEvent).where(WasteEvent.factory_id == fid)

    if line_id is not None:
        q = q.where(WasteEvent.production_line_id == line_id)
    if waste_type is not None:
        q = q.where(WasteEvent.waste_type == waste_type)
    if severity is not None:
        q = q.where(WasteEvent.severity == severity)
    if status is not None:
        q = q.where(WasteEvent.status == status)
    if date_from is not None:
        q = q.where(WasteEvent.date_occurred >= date_from)
    if date_to is not None:
        q = q.where(WasteEvent.date_occurred <= date_to)

    q = q.order_by(WasteEvent.date_occurred.desc(), WasteEvent.id.desc())
    q = q.offset(skip).limit(limit)

    result = await db.execute(q)
    return result.scalars().all()


# ─── GET /waste/summary — aggregated summary ──────────────────────────────

@router.get("/summary", response_model=WasteSummaryResponse)
async def waste_summary(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    line_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # Base filter
    filters = [WasteEvent.factory_id == fid]
    if date_from:
        filters.append(WasteEvent.date_occurred >= date_from)
    if date_to:
        filters.append(WasteEvent.date_occurred <= date_to)
    if line_id:
        filters.append(WasteEvent.production_line_id == line_id)
    base = and_(*filters)

    # By type
    type_q = (
        select(
            WasteEvent.waste_type,
            func.count(WasteEvent.id).label("count"),
            func.coalesce(func.sum(WasteEvent.estimated_cost), 0).label("total_cost"),
            func.coalesce(func.sum(WasteEvent.estimated_time_minutes), 0).label("total_time"),
        )
        .where(base)
        .group_by(WasteEvent.waste_type)
    )
    type_rows = (await db.execute(type_q)).all()

    by_type = [
        WasteSummaryByType(
            waste_type=r.waste_type,
            count=r.count,
            total_cost=float(r.total_cost),
            total_time_minutes=int(r.total_time),
        )
        for r in type_rows
    ]

    # By line
    line_q = (
        select(
            WasteEvent.production_line_id,
            func.count(WasteEvent.id).label("count"),
            func.coalesce(func.sum(WasteEvent.estimated_cost), 0).label("total_cost"),
        )
        .where(base)
        .group_by(WasteEvent.production_line_id)
    )
    line_rows = (await db.execute(line_q)).all()

    by_line = [
        WasteSummaryByLine(
            production_line_id=r.production_line_id,
            count=r.count,
            total_cost=float(r.total_cost),
        )
        for r in line_rows
    ]

    # By severity
    sev_q = (
        select(WasteEvent.severity, func.count(WasteEvent.id).label("count"))
        .where(base)
        .group_by(WasteEvent.severity)
    )
    sev_rows = (await db.execute(sev_q)).all()
    by_severity = {r.severity: r.count for r in sev_rows}

    # By status
    stat_q = (
        select(WasteEvent.status, func.count(WasteEvent.id).label("count"))
        .where(base)
        .group_by(WasteEvent.status)
    )
    stat_rows = (await db.execute(stat_q)).all()
    by_status = {r.status: r.count for r in stat_rows}

    # Totals
    total_events = sum(t.count for t in by_type)
    total_cost = sum(t.total_cost for t in by_type)
    total_time = sum(t.total_time_minutes for t in by_type)

    return WasteSummaryResponse(
        total_events=total_events,
        total_cost=total_cost,
        total_time_minutes=total_time,
        by_type=by_type,
        by_line=by_line,
        by_severity=by_severity,
        by_status=by_status,
    )


# ─── PUT /waste/{id} — update a waste event ───────────────────────────────

@router.put("/{event_id}", response_model=WasteEventResponse)
async def update_waste_event(
    event_id: int,
    data: WasteEventUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(WasteEvent).where(WasteEvent.id == event_id, WasteEvent.factory_id == fid)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Waste event not found")

    update_data = data.model_dump(exclude_unset=True)

    # IDOR check: validate production_line_id belongs to user's factory
    if "production_line_id" in update_data and update_data["production_line_id"] is not None:
        line_result = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == update_data["production_line_id"],
                ProductionLine.factory_id == fid,
            )
        )
        if not line_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")

    for field, value in update_data.items():
        setattr(event, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(event)
    return event


# ─── DELETE /waste/{id} — delete a waste event ────────────────────────────

@router.delete("/{event_id}")
async def delete_waste_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(WasteEvent).where(WasteEvent.id == event_id, WasteEvent.factory_id == fid)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Waste event not found")

    await db.delete(event)
    await db.commit()
    return {"status": "deleted"}
