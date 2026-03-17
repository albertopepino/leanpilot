"""Notification creation helpers — called from routes when events happen."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.notification import Notification
from app.models.user import User


async def create_notification(
    db: AsyncSession,
    *,
    factory_id: int,
    user_id: int,
    notification_type: str,
    title: str,
    message: str = None,
    priority: str = "medium",
    link: str = None,
    source_type: str = None,
    source_id: int = None,
) -> Notification:
    """Create a notification for a specific user."""
    notif = Notification(
        factory_id=factory_id,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        link=link,
        source_type=source_type,
        source_id=source_id,
    )
    db.add(notif)
    await db.flush()
    return notif


async def notify_factory_role(
    db: AsyncSession,
    *,
    factory_id: int,
    role: str,
    notification_type: str,
    title: str,
    message: str = None,
    priority: str = "medium",
    link: str = None,
    source_type: str = None,
    source_id: int = None,
) -> list[Notification]:
    """Create notification for all users of a given role in a factory."""
    result = await db.execute(
        select(User).where(
            User.factory_id == factory_id,
            User.role == role,
            User.is_active == True,
        )
    )
    users = result.scalars().all()
    notifications = []
    for user in users:
        notif = await create_notification(
            db,
            factory_id=factory_id,
            user_id=user.id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=priority,
            link=link,
            source_type=source_type,
            source_id=source_id,
        )
        notifications.append(notif)
    return notifications


async def notify_qc_fail(
    db: AsyncSession,
    *,
    factory_id: int,
    qc_record_id: int,
    line_name: str,
    check_type: str,
):
    """QC fail → notify supervisors and managers."""
    title = f"QC Check Failed: {check_type} on {line_name}"
    message = f"A {check_type} check has failed on {line_name}. Andon and NCR have been auto-created."

    await notify_factory_role(
        db,
        factory_id=factory_id,
        role="manager",
        notification_type="qc_fail",
        title=title,
        message=message,
        priority="high",
        link=f"/measure/qc",
        source_type="qc_record",
        source_id=qc_record_id,
    )
    await notify_factory_role(
        db,
        factory_id=factory_id,
        role="supervisor",
        notification_type="qc_fail",
        title=title,
        message=message,
        priority="high",
        link=f"/measure/qc",
        source_type="qc_record",
        source_id=qc_record_id,
    )
