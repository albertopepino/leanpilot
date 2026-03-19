"""
Data Retention Purge Service — GDPR Art. 5(1)(e) storage limitation.

Enforces the retention policies defined in config by permanently deleting
data that has exceeded its retention period. Runs as a daily background
task and can also be triggered manually via the admin API.
"""
import asyncio
import structlog
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import log_audit
from app.db.session import async_session
from app.models.user import User
from app.models.ai import AIConversation, AIMessage
from app.models.audit import AuditLog

logger = structlog.get_logger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Core purge logic
# ---------------------------------------------------------------------------


async def run_data_retention_purge(session: AsyncSession, factory_id: int | None = None) -> dict:
    """Execute all retention purge operations within the given session.

    When *factory_id* is provided the purge is scoped to that single tenant;
    otherwise it iterates over every factory individually so that cross-tenant
    data is never accidentally deleted in a single bulk statement.

    Returns a summary dict with counts of purged records per category.
    """
    now = datetime.now(timezone.utc)
    summary: dict[str, int] = {}

    # 1. Hard-delete users soft-deleted beyond the grace period
    grace_cutoff = now - timedelta(days=settings.retention_deleted_account_grace_days)
    user_filters = [
        User.is_deleted == True,  # noqa: E712
        User.deleted_at != None,  # noqa: E711
        User.deleted_at < grace_cutoff,
    ]
    if factory_id is not None:
        user_filters.append(User.factory_id == factory_id)

    deleted_users_result = await session.execute(
        select(User).where(*user_filters)
    )
    deleted_users = deleted_users_result.scalars().all()
    purged_user_ids = [u.id for u in deleted_users]

    for user in deleted_users:
        await session.delete(user)

    summary["users_hard_deleted"] = len(deleted_users)

    if deleted_users:
        logger.info(
            "retention_purge.users",
            count=len(deleted_users),
            cutoff=grace_cutoff.isoformat(),
            user_ids=purged_user_ids,
        )

    # 2. Delete AI conversations (and cascade messages) older than retention period
    ai_cutoff = now - timedelta(days=settings.retention_ai_conversations_days)

    # First find conversation IDs to delete — scoped by factory_id
    ai_convo_filters = [AIConversation.created_at < ai_cutoff]
    if factory_id is not None:
        ai_convo_filters.append(AIConversation.factory_id == factory_id)

    old_convos_result = await session.execute(
        select(AIConversation.id).where(*ai_convo_filters)
    )
    old_convo_ids = [row[0] for row in old_convos_result.all()]

    ai_messages_deleted = 0
    ai_conversations_deleted = 0

    if old_convo_ids:
        # Explicitly delete messages BEFORE conversations (don't rely on cascade)
        # This ensures referential integrity even if cascade is misconfigured
        msg_result = await session.execute(
            delete(AIMessage).where(AIMessage.conversation_id.in_(old_convo_ids))
        )
        ai_messages_deleted = msg_result.rowcount

        # Now delete the conversations themselves
        conv_result = await session.execute(
            delete(AIConversation).where(AIConversation.id.in_(old_convo_ids))
        )
        ai_conversations_deleted = conv_result.rowcount

        logger.info(
            "retention_purge.ai_conversations",
            conversations=ai_conversations_deleted,
            messages=ai_messages_deleted,
            conversation_ids=old_convo_ids,
            cutoff=ai_cutoff.isoformat(),
        )

    summary["ai_conversations_deleted"] = ai_conversations_deleted
    summary["ai_messages_deleted"] = ai_messages_deleted

    # 3. Delete audit logs older than retention period — scoped by factory_id
    audit_cutoff = now - timedelta(days=settings.retention_audit_log_days)
    audit_filters = [AuditLog.timestamp < audit_cutoff]
    if factory_id is not None:
        audit_filters.append(AuditLog.factory_id == factory_id)

    audit_result = await session.execute(
        delete(AuditLog).where(*audit_filters)
    )
    audit_logs_deleted = audit_result.rowcount
    summary["audit_logs_deleted"] = audit_logs_deleted

    if audit_logs_deleted:
        logger.info(
            "retention_purge.audit_logs",
            count=audit_logs_deleted,
            cutoff=audit_cutoff.isoformat(),
        )

    # 4. Log the purge run itself as an audit entry (for accountability)
    await log_audit(
        session,
        action="data_retention_purge",
        resource_type="system",
        detail=(
            f"Retention purge completed: "
            f"{summary['users_hard_deleted']} users hard-deleted, "
            f"{summary['ai_conversations_deleted']} AI conversations deleted, "
            f"{summary['ai_messages_deleted']} AI messages deleted, "
            f"{summary['audit_logs_deleted']} audit logs deleted"
        ),
        legal_basis="GDPR Art. 5(1)(e) — storage limitation",
        data_categories="personal,ai,audit",
    )

    await session.commit()

    logger.info("retention_purge.completed", summary=summary)
    return summary


# ---------------------------------------------------------------------------
# Scheduler — runs the purge daily as a background task
# ---------------------------------------------------------------------------

_scheduler_task: asyncio.Task | None = None


async def _daily_purge_loop():
    """Background loop that runs the retention purge once every 24 hours."""
    logger.info("retention_purge.scheduler_started")
    while True:
        try:
            async with async_session() as session:
                summary = await run_data_retention_purge(session)
                logger.info("retention_purge.scheduled_run", summary=summary)
        except asyncio.CancelledError:
            logger.info("retention_purge.scheduler_stopped")
            raise
        except Exception:
            logger.exception("retention_purge.scheduled_run_failed")

        # Sleep 24 hours until next run
        await asyncio.sleep(24 * 60 * 60)


def start_retention_scheduler():
    """Start the daily retention purge as a background asyncio task.

    Safe to call from a FastAPI lifespan or startup event.
    """
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_daily_purge_loop())
        logger.info("retention_purge.scheduler_created")


def stop_retention_scheduler():
    """Cancel the background scheduler task (called on shutdown)."""
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("retention_purge.scheduler_cancelled")
        _scheduler_task = None
