"""Notification System — CRUD + SSE stream."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse, NotificationCountResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50),
    skip: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/count", response_model=NotificationCountResponse)
async def get_count(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    unread_q = select(func.count(Notification.id)).where(
        and_(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    total_q = select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id
    )
    unread = (await db.execute(unread_q)).scalar() or 0
    total = (await db.execute(total_q)).scalar() or 0
    return NotificationCountResponse(unread=unread, total=total)


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False,
            )
        )
        .values(is_read=True, read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found")
    await db.delete(notif)
    await db.commit()
    return {"ok": True}
