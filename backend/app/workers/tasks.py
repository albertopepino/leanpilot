"""
Background job definitions for the arq worker.

Run with:  arq app.workers.tasks.WorkerSettings
"""
import os
import structlog
from arq.connections import RedisSettings

logger = structlog.get_logger(__name__)


def _redis_settings() -> RedisSettings:
    """Parse REDIS_URL into arq RedisSettings."""
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # redis://host:port/db
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        password=parsed.password,
    )


async def send_email_task(ctx: dict, to: str, subject: str, body: str):
    """Send an email in the background."""
    logger.info("task.send_email", to=to, subject=subject)
    try:
        from app.services.email_service import EmailService
        result = await EmailService._send(to, subject, body)
        return {"sent": result}
    except Exception as exc:
        logger.error("task.send_email.failed", error=str(exc))
        raise


async def generate_export_task(ctx: dict, factory_id: int, user_id: int):
    """Generate a heavy data export (CSV/Excel) in the background."""
    logger.info("task.generate_export", factory_id=factory_id, user_id=user_id)
    try:
        # Placeholder — wire up actual export logic as needed
        return {"status": "completed", "factory_id": factory_id}
    except Exception as exc:
        logger.error("task.generate_export.failed", error=str(exc))
        raise


class WorkerSettings:
    """arq worker configuration."""
    functions = [send_email_task, generate_export_task]
    redis_settings = _redis_settings()
    max_jobs = 10
    job_timeout = 300  # 5 minutes
