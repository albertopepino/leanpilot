"""
General API rate limiting middleware.
Applies a sliding-window rate limit to all API endpoints using Redis (with in-memory fallback).
GDPR Art. 32 — security of processing (prevents abuse and enumeration attacks).
"""
import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings

logger = structlog.get_logger(__name__)

# Paths excluded from general rate limiting (health checks, static assets)
_EXCLUDED_PREFIXES = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/static",
    "/favicon",
)

# Redis client (lazy-initialized, shared with security module)
_redis_client = None

# In-memory fallback for when Redis is unavailable
_fallback_buckets: dict[str, list[float]] = {}
_FALLBACK_MAX_KEYS = 10_000
_FALLBACK_TTL_SECONDS = 3600  # 1 hour


def _get_redis():
    """Lazy-init Redis connection for rate limiting."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis as redis_lib
        settings = get_settings()
        _redis_client = redis_lib.Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        _redis_client.ping()
        logger.info("Rate limit middleware: Redis connected")
    except Exception as e:
        logger.warning(f"Rate limit middleware: Redis unavailable ({e}), using in-memory fallback")
        _redis_client = None
    return _redis_client


def _extract_client_ip(request: Request) -> str:
    """Extract client IP from proxy headers or direct connection."""
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",")]
        return parts[-1] if parts else "unknown"
    return request.client.host if request.client else "unknown"


def _extract_user_id(request: Request) -> str | None:
    """Try to extract user ID from a valid JWT in the Authorization header.
    Returns None if no valid token is present (anonymous request).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        from jose import jwt
        settings = get_settings()
        token = auth_header[7:]
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except Exception:
        return None


def _check_rate_limit_redis(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """Check rate limit using Redis sorted set. Returns (allowed, current_count)."""
    r = _get_redis()
    if not r:
        return _check_rate_limit_memory(key, max_requests, window_seconds)
    try:
        redis_key = f"rl:api:{key}"
        now = time.time()
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, window_seconds)
        results = pipe.execute()
        count = results[1]
        return (count < max_requests, count)
    except Exception:
        return _check_rate_limit_memory(key, max_requests, window_seconds)


def _prune_fallback_buckets() -> None:
    """Evict stale entries from the in-memory rate limiter to prevent OOM."""
    if len(_fallback_buckets) <= _FALLBACK_MAX_KEYS:
        return
    now = time.time()
    cutoff = now - _FALLBACK_TTL_SECONDS
    stale_keys = [k for k, v in _fallback_buckets.items() if not v or v[-1] < cutoff]
    for k in stale_keys:
        del _fallback_buckets[k]
    if len(_fallback_buckets) > _FALLBACK_MAX_KEYS:
        sorted_keys = sorted(_fallback_buckets, key=lambda k: _fallback_buckets[k][-1] if _fallback_buckets[k] else 0)
        for k in sorted_keys[:len(_fallback_buckets) - _FALLBACK_MAX_KEYS]:
            del _fallback_buckets[k]


def _check_rate_limit_memory(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    """Fallback in-memory rate limiter."""
    _prune_fallback_buckets()
    now = time.time()
    cutoff = now - window_seconds
    attempts = _fallback_buckets.get(key, [])
    attempts = [t for t in attempts if t > cutoff]
    count = len(attempts)
    if count >= max_requests:
        _fallback_buckets[key] = attempts
        return (False, count)
    attempts.append(now)
    _fallback_buckets[key] = attempts
    return (True, count)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware that applies per-user (or per-IP) rate limiting
    to all API endpoints using a sliding window counter.

    Default: 60 requests per minute (configurable via settings.rate_limit_api_per_minute).
    Returns 429 Too Many Requests with Retry-After header when exceeded.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip excluded paths
        if any(path.startswith(prefix) for prefix in _EXCLUDED_PREFIXES):
            return await call_next(request)

        settings = get_settings()
        max_requests = settings.rate_limit_api_per_minute
        window_seconds = 60

        # Use user ID if authenticated, otherwise fall back to IP
        user_id = _extract_user_id(request)
        if user_id:
            rate_key = f"user:{user_id}"
        else:
            client_ip = _extract_client_ip(request)
            rate_key = f"ip:{client_ip}"

        allowed, count = _check_rate_limit_redis(rate_key, max_requests, window_seconds)

        if not allowed:
            retry_after = window_seconds
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Too many requests. Limit: {max_requests} per {window_seconds}s. Try again later.",
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                },
            )

        response = await call_next(request)

        # Add rate limit headers to successful responses
        remaining = max(0, max_requests - count - 1)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window_seconds)

        return response
