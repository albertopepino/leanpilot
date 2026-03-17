"""SQCDP Board & Tier Meetings — Daily visual management."""
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.sqcdp import SQCDPEntry, SQCDPMeeting
from app.schemas.sqcdp import (
    SQCDPEntryCreate, SQCDPEntryUpdate, SQCDPEntryResponse,
    SQCDPMeetingCreate, SQCDPMeetingResponse, SQCDPBoardResponse,
)

router = APIRouter(prefix="/sqcdp", tags=["SQCDP"])


@router.post("/entries", response_model=SQCDPEntryResponse)
async def create_entry(
    data: SQCDPEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    entry = SQCDPEntry(
        factory_id=current_user.factory_id,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/entries", response_model=list[SQCDPEntryResponse])
async def list_entries(
    target_date: date = Query(None),
    line_id: int = Query(None),
    tier_level: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SQCDPEntry).where(SQCDPEntry.factory_id == current_user.factory_id)
    if target_date:
        q = q.where(SQCDPEntry.date == target_date)
    if line_id:
        q = q.where(SQCDPEntry.production_line_id == line_id)
    if tier_level:
        q = q.where(SQCDPEntry.tier_level == tier_level)
    q = q.order_by(SQCDPEntry.date.desc(), SQCDPEntry.category)
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
            SQCDPEntry.factory_id == current_user.factory_id,
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
    result = await db.execute(
        select(SQCDPEntry).where(
            SQCDPEntry.id == entry_id,
            SQCDPEntry.factory_id == current_user.factory_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(SQCDPEntry).where(
            SQCDPEntry.id == entry_id,
            SQCDPEntry.factory_id == current_user.factory_id,
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
        factory_id=current_user.factory_id,
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
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SQCDPMeeting).where(SQCDPMeeting.factory_id == current_user.factory_id)
    if tier_level:
        q = q.where(SQCDPMeeting.tier_level == tier_level)
    q = q.order_by(SQCDPMeeting.date.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
