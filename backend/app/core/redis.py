"""
Redis client singleton with cache helpers.
Graceful fallback when Redis is unavailable — logs a warning and skips cache.
"""
import json
from typing import Any, Optional

import structlog

logger = structlog.get_logger(__name__)

_redis_client = None
_redis_unavailable = False


async def get_redis():
    """Return a shared aioredis client, creating it on first call."""
    global _redis_client, _redis_unavailable

    if _redis_unavailable:
        return None

    if _redis_client is not None:
        return _redis_client

    try:
        from redis.asyncio import from_url
        from app.core.config import get_settings

        settings = get_settings()
        _redis_client = from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        # Verify connectivity
        await _redis_client.ping()
        logger.info("redis.connected", url=settings.redis_url.split("@")[-1])
        return _redis_client
    except Exception as exc:
        _redis_unavailable = True
        logger.warning("redis.unavailable", error=str(exc))
        return None


async def cache_get(key: str) -> Optional[Any]:
    """Get a cached value by key. Returns None on miss or if Redis is down."""
    client = await get_redis()
    if client is None:
        return None
    try:
        raw = await client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("redis.cache_get.error", key=key, error=str(exc))
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set a cached value with TTL in seconds. Returns False on failure."""
    client = await get_redis()
    if client is None:
        return False
    try:
        await client.set(key, json.dumps(value, default=str), ex=ttl)
        return True
    except Exception as exc:
        logger.warning("redis.cache_set.error", key=key, error=str(exc))
        return False


async def cache_delete(key: str) -> bool:
    """Delete a cached key. Returns False on failure."""
    client = await get_redis()
    if client is None:
        return False
    try:
        await client.delete(key)
        return True
    except Exception as exc:
        logger.warning("redis.cache_delete.error", key=key, error=str(exc))
        return False
