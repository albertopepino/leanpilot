"""
Lightweight helper to enqueue background jobs via arq.
Falls back gracefully if Redis is unavailable.
"""
import os
import structlog
from typing import Any

logger = structlog.get_logger(__name__)

_pool = None


def _redis_settings():
    from arq.connections import RedisSettings
    from urllib.parse import urlparse

    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        password=parsed.password,
    )


async def enqueue(function_name: str, **kwargs: Any) -> bool:
    """Enqueue a background job. Returns True on success, False on failure."""
    global _pool
    try:
        if _pool is None:
            from arq import create_pool
            _pool = await create_pool(_redis_settings())

        await _pool.enqueue_job(function_name, **kwargs)
        logger.info("queue.enqueued", function=function_name)
        return True
    except Exception as exc:
        logger.warning("queue.enqueue.failed", function=function_name, error=str(exc))
        return False
