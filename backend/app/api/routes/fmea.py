"""FMEA — Failure Mode and Effects Analysis API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import structlog

logger = structlog.get_logger(__name__)

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.fmea import FMEAAnalysis, FMEAItem
from app.schemas.fmea import (
    FMEACreate, FMEAUpdate, FMEAResponse,
    FMEAItemCreate, FMEAItemUpdate, FMEAItemResponse,
)

router = APIRouter(prefix="/fmea", tags=["fmea"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calc_rpn(s: int, o: int, d: int) -> int:
    """Calculate Risk Priority Number = Severity x Occurrence x Detection."""
    return max(1, min(s, 10)) * max(1, min(o, 10)) * max(1, min(d, 10))


async def _get_analysis(db: AsyncSession, analysis_id: int, factory_id: int) -> FMEAAnalysis:
    """Fetch a single FMEA analysis with items, scoped to factory."""
    stmt = (
        select(FMEAAnalysis)
        .options(selectinload(FMEAAnalysis.items))
        .where(FMEAAnalysis.id == analysis_id, FMEAAnalysis.factory_id == factory_id)
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="FMEA analysis not found")
    return analysis


# ---------------------------------------------------------------------------
# Analysis CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=FMEAResponse)
async def create_fmea(
    data: FMEACreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new FMEA analysis with optional nested items."""
    fid = require_factory(user)
    analysis = FMEAAnalysis(
        factory_id=fid,
        created_by_id=user.id,
        title=data.title,
        fmea_type=data.fmea_type,
        product_name=data.product_name,
        process_name=data.process_name,
        team_members=data.team_members,
    )
    for item_data in data.items:
        rpn = _calc_rpn(item_data.severity, item_data.occurrence, item_data.detection)
        item = FMEAItem(
            **item_data.model_dump(),
            rpn=rpn,
        )
        analysis.items.append(item)
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    # Reload with items
    return await _get_analysis(db, analysis.id, fid)


@router.get("/", response_model=list[FMEAResponse])
async def list_fmea(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all FMEA analyses for the user's factory."""
    fid = require_factory(user)
    stmt = (
        select(FMEAAnalysis)
        .options(selectinload(FMEAAnalysis.items))
        .where(FMEAAnalysis.factory_id == fid)
        .order_by(FMEAAnalysis.id.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{analysis_id}", response_model=FMEAResponse)
async def get_fmea(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single FMEA analysis with all items."""
    fid = require_factory(user)
    return await _get_analysis(db, analysis_id, fid)


@router.patch("/{analysis_id}", response_model=FMEAResponse)
async def update_fmea(
    analysis_id: int,
    data: FMEAUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update FMEA analysis metadata."""
    fid = require_factory(user)
    analysis = await _get_analysis(db, analysis_id, fid)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(analysis, key, value)
    await db.commit()
    return await _get_analysis(db, analysis_id, fid)


@router.delete("/{analysis_id}")
async def delete_fmea(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an FMEA analysis and all its items."""
    fid = require_factory(user)
    analysis = await _get_analysis(db, analysis_id, fid)
    await db.delete(analysis)
    await db.commit()
    return {"detail": "FMEA analysis deleted", "id": analysis_id}


# ---------------------------------------------------------------------------
# Item CRUD
# ---------------------------------------------------------------------------

@router.post("/{analysis_id}/items", response_model=FMEAItemResponse)
async def add_fmea_item(
    analysis_id: int,
    data: FMEAItemCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Add a new item (failure mode) to an existing FMEA analysis."""
    fid = require_factory(user)
    # Verify analysis exists and belongs to factory
    await _get_analysis(db, analysis_id, fid)
    rpn = _calc_rpn(data.severity, data.occurrence, data.detection)
    item = FMEAItem(
        analysis_id=analysis_id,
        **data.model_dump(),
        rpn=rpn,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{analysis_id}/items/{item_id}", response_model=FMEAItemResponse)
async def update_fmea_item(
    analysis_id: int,
    item_id: int,
    data: FMEAItemUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an FMEA item. Auto-calculates RPN and new_rpn."""
    fid = require_factory(user)
    # Verify analysis belongs to factory
    await _get_analysis(db, analysis_id, fid)

    stmt = select(FMEAItem).where(FMEAItem.id == item_id, FMEAItem.analysis_id == analysis_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="FMEA item not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    # Auto-calculate RPN from current severity/occurrence/detection
    item.rpn = _calc_rpn(item.severity, item.occurrence, item.detection)

    # Auto-calculate new_rpn if all new_* values are present
    if item.new_severity is not None and item.new_occurrence is not None and item.new_detection is not None:
        item.new_rpn = _calc_rpn(item.new_severity, item.new_occurrence, item.new_detection)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{analysis_id}/items/{item_id}")
async def delete_fmea_item(
    analysis_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a single FMEA item."""
    fid = require_factory(user)
    await _get_analysis(db, analysis_id, fid)

    stmt = select(FMEAItem).where(FMEAItem.id == item_id, FMEAItem.analysis_id == analysis_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="FMEA item not found")

    await db.delete(item)
    await db.commit()
    return {"detail": "FMEA item deleted", "id": item_id}
