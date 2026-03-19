from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.pokayoke import PokaYokeDevice, PokaYokeVerification
from app.models.factory import ProductionLine
from app.schemas.pokayoke import (
    PokaYokeDeviceCreate, PokaYokeDeviceUpdate, PokaYokeDeviceResponse,
    PokaYokeVerificationCreate, PokaYokeVerificationResponse,
    PokaYokeStatsResponse,
)
from app.services.pokayoke_service import PokaYokeService

router = APIRouter(prefix="/pokayoke", tags=["pokayoke"])


# ─── Device endpoints ────────────────────────────────────────────────────────

@router.get("/devices", response_model=list[PokaYokeDeviceResponse])
async def list_devices(
    line_id: int | None = Query(None, description="Filter by production line"),
    device_type: str | None = Query(None, description="Filter by device type"),
    status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    q = select(PokaYokeDevice).where(PokaYokeDevice.factory_id == fid)

    if line_id is not None:
        q = q.where(PokaYokeDevice.production_line_id == line_id)
    if device_type is not None:
        q = q.where(PokaYokeDevice.device_type == device_type)
    if status is not None:
        q = q.where(PokaYokeDevice.status == status)

    q = q.order_by(PokaYokeDevice.name).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/devices", response_model=PokaYokeDeviceResponse)
async def create_device(
    data: PokaYokeDeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # IDOR check: validate production line
    if data.production_line_id is not None:
        line_result = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == data.production_line_id,
                ProductionLine.factory_id == fid,
            )
        )
        if not line_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")

    device = PokaYokeDevice(
        factory_id=fid,
        created_by_id=user.id,
        **data.model_dump(),
    )
    db.add(device)
    await db.flush()
    await db.commit()
    await db.refresh(device)
    return device


@router.patch("/devices/{device_id}", response_model=PokaYokeDeviceResponse)
async def update_device(
    device_id: int,
    data: PokaYokeDeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(PokaYokeDevice).where(
            PokaYokeDevice.id == device_id,
            PokaYokeDevice.factory_id == fid,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    update_data = data.model_dump(exclude_unset=True)

    # IDOR check on line
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
        setattr(device, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/devices/{device_id}")
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(PokaYokeDevice).where(
            PokaYokeDevice.id == device_id,
            PokaYokeDevice.factory_id == fid,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(device)
    await db.commit()
    return {"status": "deleted"}


# ─── Verification endpoints ──────────────────────────────────────────────────

@router.get("/devices/{device_id}/verifications", response_model=list[PokaYokeVerificationResponse])
async def list_verifications(
    device_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # Verify device belongs to factory
    dev_result = await db.execute(
        select(PokaYokeDevice).where(
            PokaYokeDevice.id == device_id,
            PokaYokeDevice.factory_id == fid,
        )
    )
    if not dev_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Device not found")

    result = await db.execute(
        select(PokaYokeVerification)
        .where(PokaYokeVerification.device_id == device_id)
        .order_by(PokaYokeVerification.verified_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/devices/{device_id}/verify", response_model=PokaYokeVerificationResponse)
async def verify_device(
    device_id: int,
    data: PokaYokeVerificationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(PokaYokeDevice).where(
            PokaYokeDevice.id == device_id,
            PokaYokeDevice.factory_id == fid,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    verification = await PokaYokeService.record_verification(
        db, device, user.id, data.result, data.notes
    )
    return verification


# ─── Overdue / Stats endpoints ───────────────────────────────────────────────

@router.get("/overdue", response_model=list[PokaYokeDeviceResponse])
async def list_overdue(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    devices = await PokaYokeService.get_overdue_devices(db, fid)
    return devices


@router.get("/stats", response_model=PokaYokeStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    stats = await PokaYokeService.compute_stats(db, fid)
    return PokaYokeStatsResponse(**stats)
