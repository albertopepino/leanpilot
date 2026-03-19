import os
import time
from contextlib import asynccontextmanager
import structlog
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Sentry error monitoring (optional — set SENTRY_DSN env var)
# ---------------------------------------------------------------------------
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        sentry_sdk.init(
            dsn=_sentry_dsn,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            traces_sample_rate=0.2,
            send_default_pii=False,  # GDPR — no PII to Sentry
            environment=os.getenv("ENVIRONMENT", "production"),
        )
    except ImportError:
        pass  # sentry-sdk not installed — skip silently

from app.core.config import get_settings
from app.core.security import get_current_active_admin
from app.core.logging import setup_logging
from app.services.data_retention import (
    start_retention_scheduler,
    stop_retention_scheduler,
    run_data_retention_purge,
)
from app.api.routes import auth, production, oee, lean, ai, lean_advanced
from app.api.routes import privacy, admin, manufacturing, qc, totp, groups, calendar, waste
from app.api.routes import sqcdp, shift_handover, notifications, lsw, audit_schedule, reports
from app.api.routes import ws, horizontal_deploy, safety, kanban, pokayoke, spc
from app.api.routes.company_settings import (
    admin_router as company_admin_router,
    public_router as company_public_router,
)

settings = get_settings()
setup_logging(debug=settings.debug)
logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Lifespan — start/stop background tasks (GDPR data retention scheduler)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    start_retention_scheduler()
    logger.info("lifespan.startup", detail="Data retention scheduler started")
    yield
    stop_retention_scheduler()
    logger.info("lifespan.shutdown", detail="Data retention scheduler stopped")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Lean Manufacturing Management Platform for SME Factories",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Security headers middleware — GDPR Art. 32 (security of processing)
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        if not settings.debug:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting middleware — GDPR Art. 32 (security of processing)
try:
    from app.middleware.rate_limit import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware)
except ImportError:
    pass  # middleware not available — skip


# ---------------------------------------------------------------------------
# Request logging middleware — structured observability
# ---------------------------------------------------------------------------

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        if not request.url.path.startswith("/api/health"):
            log_fn = logger.warning if duration_ms > 500 else logger.info
            log_fn(
                "request.slow" if duration_ms > 500 else "request",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
                client=request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown"),
            )
        return response


app.add_middleware(RequestLoggingMiddleware)

# CORS — origins from config (not hardcoded)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API versioning — v1 router with /api/ backwards-compatibility alias
# ---------------------------------------------------------------------------
v1_router = APIRouter()
v1_router.include_router(auth.router)
v1_router.include_router(production.router)
v1_router.include_router(oee.router)
v1_router.include_router(lean.router)
v1_router.include_router(lean_advanced.router)
v1_router.include_router(ai.router)
v1_router.include_router(privacy.router)
v1_router.include_router(admin.router)
v1_router.include_router(manufacturing.router)
v1_router.include_router(qc.router)
v1_router.include_router(totp.router)
v1_router.include_router(groups.router)
v1_router.include_router(calendar.router)
v1_router.include_router(waste.router)
v1_router.include_router(company_admin_router)
v1_router.include_router(company_public_router)
v1_router.include_router(sqcdp.router)
v1_router.include_router(shift_handover.router)
v1_router.include_router(notifications.router)
v1_router.include_router(lsw.router)
v1_router.include_router(audit_schedule.router)
v1_router.include_router(reports.router)
v1_router.include_router(horizontal_deploy.router)
v1_router.include_router(safety.router)
v1_router.include_router(kanban.router)
v1_router.include_router(pokayoke.router)
v1_router.include_router(spc.router)

# Mount under /api/v1 (canonical) and /api (backwards-compatible alias)
app.include_router(v1_router, prefix="/api/v1")
app.include_router(v1_router, prefix="/api")

# WebSocket routes (no versioned prefix)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    """Health check with database probe."""
    db_ok = False
    try:
        from app.db.session import async_session
        async with async_session() as session:
            await session.execute(select(1))
            db_ok = True
    except Exception:
        pass
    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "version": settings.app_version,
        "ai_module": True,
        "database": "connected" if db_ok else "unavailable",
    }


# ---------------------------------------------------------------------------
# Metrics endpoint — lightweight Prometheus-compatible metrics
# ---------------------------------------------------------------------------
_request_count: dict[str, int] = {}
_error_count: dict[str, int] = {}


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track request counts and errors for /api/metrics."""
    response = await call_next(request)
    path = request.url.path
    if not path.startswith("/api/metrics") and not path.startswith("/api/health"):
        _request_count[path] = _request_count.get(path, 0) + 1
        if response.status_code >= 400:
            key = f"{response.status_code}:{path}"
            _error_count[key] = _error_count.get(key, 0) + 1
    return response


@app.get("/api/metrics")
async def metrics(_admin=Depends(get_current_active_admin)):
    """Lightweight metrics endpoint. Requires admin auth. Connect Prometheus/Grafana here."""
    import psutil
    try:
        cpu = psutil.cpu_percent(interval=0)
        mem = psutil.virtual_memory()
        system = {"cpu_percent": cpu, "memory_used_mb": round(mem.used / 1048576), "memory_percent": mem.percent}
    except Exception:
        system = {}
    return {
        "requests_by_path": dict(sorted(_request_count.items(), key=lambda x: x[1], reverse=True)[:20]),
        "errors": dict(sorted(_error_count.items(), key=lambda x: x[1], reverse=True)[:20]),
        "total_requests": sum(_request_count.values()),
        "total_errors": sum(_error_count.values()),
        "system": system,
    }


# ---------------------------------------------------------------------------
# Data retention manual purge — GDPR Art. 5(1)(e) storage limitation
# ---------------------------------------------------------------------------

@app.post("/api/v1/admin/retention/purge")
async def manual_retention_purge(
    _admin=Depends(get_current_active_admin),
):
    """Manually trigger the data retention purge. Requires admin auth.

    Deletes expired data according to the configured retention periods:
    - Soft-deleted users past the grace period (hard delete)
    - AI conversations older than retention_ai_conversations_days
    - Audit logs older than retention_audit_log_days
    """
    from app.db.session import async_session as _async_session

    async with _async_session() as session:
        summary = await run_data_retention_purge(session)

    return {
        "status": "completed",
        "summary": summary,
        "retention_config": {
            "deleted_account_grace_days": settings.retention_deleted_account_grace_days,
            "ai_conversations_days": settings.retention_ai_conversations_days,
            "audit_log_days": settings.retention_audit_log_days,
        },
    }


@app.get("/api/v1/features")
async def features():
    """All features enabled - full demo mode."""
    return {
        "core": {
            "oee_dashboard": True,
            "five_why": True,
            "ishikawa": True,
            "kaizen_board": True,
            "smed_tracker": True,
            "production_logging": True,
            "downtime_tracking": True,
            "scrap_tracking": True,
        },
        "advanced_lean": {
            "six_s_audit": True,
            "value_stream_mapping": True,
            "a3_report": True,
            "gemba_walk": True,
            "tpm": True,
            "cilt": True,
            "andon_board": True,
            "pareto_analysis": True,
        },
        "manufacturing": {
            "products": True,
            "bom": True,
            "production_orders": True,
            "work_centers": True,
        },
        "quality_control": {
            "defect_catalog": True,
            "qc_templates": True,
            "line_clearance": True,
            "fga": True,
            "in_process_checks": True,
            "ncr": True,
            "capa": True,
        },
        "ai": {
            "factory_copilot": True,
            "root_cause_ai": True,
            "auto_kaizen": True,
            "gemba_vision": True,
        },
        "phase1": {
            "sqcdp_board": True,
            "shift_handover": True,
            "quality_loop": True,
            "notifications": True,
        },
        "phase3": {
            "leader_standard_work": True,
            "audit_scheduling": True,
        },
        "phase4": {
            "websocket_realtime": True,
            "horizontal_deployment": True,
        },
        "phase5": {
            "kanban_board": True,
            "poka_yoke": True,
            "qc_dashboard": True,
            "spc_charts": True,
            "setup_wizard": True,
            "contextual_help": True,
        },
    }
