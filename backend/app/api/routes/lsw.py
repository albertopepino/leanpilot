"""Leader Standard Work — templates and daily completions."""
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.leader_standard_work import LeaderStandardWork, LSWCompletion
from app.schemas.leader_standard_work import (
    LSWCreate, LSWUpdate, LSWResponse,
    LSWCompletionCreate, LSWCompletionResponse,
)

router = APIRouter(prefix="/lsw", tags=["Leader Standard Work"])


@router.post("/", response_model=LSWResponse)
async def create_lsw(
    data: LSWCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    lsw = LeaderStandardWork(
        factory_id=current_user.factory_id,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(lsw)
    await db.commit()
    await db.refresh(lsw)
    return lsw


@router.get("/", response_model=list[LSWResponse])
async def list_lsw(
    role: str = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(LeaderStandardWork).where(
        LeaderStandardWork.factory_id == current_user.factory_id
    )
    if role:
        q = q.where(LeaderStandardWork.role == role)
    if active_only:
        q = q.where(LeaderStandardWork.is_active == True)
    q = q.order_by(LeaderStandardWork.role, LeaderStandardWork.title)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/{lsw_id}", response_model=LSWResponse)
async def update_lsw(
    lsw_id: int,
    data: LSWUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(LeaderStandardWork).where(
            LeaderStandardWork.id == lsw_id,
            LeaderStandardWork.factory_id == current_user.factory_id,
        )
    )
    lsw = result.scalar_one_or_none()
    if not lsw:
        raise HTTPException(404, "LSW template not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(lsw, k, v)
    await db.commit()
    await db.refresh(lsw)
    return lsw


@router.delete("/{lsw_id}")
async def delete_lsw(
    lsw_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(LeaderStandardWork).where(
            LeaderStandardWork.id == lsw_id,
            LeaderStandardWork.factory_id == current_user.factory_id,
        )
    )
    lsw = result.scalar_one_or_none()
    if not lsw:
        raise HTTPException(404, "LSW template not found")
    await db.delete(lsw)
    await db.commit()
    return {"ok": True}


# --- Completions ---

@router.post("/completions", response_model=LSWCompletionResponse)
async def log_completion(
    data: LSWCompletionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    completion = LSWCompletion(
        completed_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(completion)
    await db.commit()
    await db.refresh(completion)
    return completion


@router.get("/completions", response_model=list[LSWCompletionResponse])
async def list_completions(
    lsw_id: int = Query(None),
    target_date: date = Query(None),
    limit: int = Query(30),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(LSWCompletion).where(
        LSWCompletion.completed_by_id == current_user.id
    )
    if lsw_id:
        q = q.where(LSWCompletion.lsw_id == lsw_id)
    if target_date:
        q = q.where(LSWCompletion.date == target_date)
    q = q.order_by(LSWCompletion.date.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
