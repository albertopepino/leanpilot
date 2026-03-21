"""
Company settings routes — logo upload, serve, and delete.
Admin-only write operations; any authenticated user can read the logo.
"""
import asyncio
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import (
    get_current_active_admin,
    get_current_user,
    require_factory,
    log_audit,
)
from app.models.user import User
from app.models.company_settings import CompanySettings

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

LOGO_UPLOAD_DIR = "/app/uploads/logos"
ALLOWED_LOGO_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    # SVG removed: XML-based format can contain <script> tags (stored XSS risk)
}
MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB

MIME_BY_EXT = {v: k for k, v in ALLOWED_LOGO_TYPES.items()}

# ---------------------------------------------------------------------------
# Admin router — upload / delete
# ---------------------------------------------------------------------------

admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.post("/company-logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Upload or replace the company logo (PNG, JPG — max 2 MB)."""
    fid = require_factory(admin)

    # Validate content type
    if not file.content_type or file.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(400, "File type not allowed. Accepted: PNG, JPG.")

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_LOGO_SIZE:
        raise HTTPException(400, "File too large. Maximum 2 MB.")

    # Basic magic-byte validation
    if file.content_type == "image/png" and not contents[:4] == b"\x89PNG":
        raise HTTPException(400, "Invalid PNG file.")
    if file.content_type == "image/jpeg" and not contents[:2] == b"\xff\xd8":
        raise HTTPException(400, "Invalid JPEG file.")

    await asyncio.to_thread(os.makedirs, LOGO_UPLOAD_DIR, exist_ok=True)

    ext = ALLOWED_LOGO_TYPES[file.content_type]
    safe_name = f"factory_{fid}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(LOGO_UPLOAD_DIR, safe_name)

    # Look up existing settings
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.factory_id == fid)
    )
    settings = result.scalar_one_or_none()

    # Delete old file if exists
    if settings and settings.logo_filename:
        old_path = os.path.join(LOGO_UPLOAD_DIR, settings.logo_filename)
        if os.path.exists(old_path):
            await asyncio.to_thread(os.remove, old_path)

    # Write new file
    def _write_file():
        with open(file_path, "wb") as f:
            f.write(contents)

    await asyncio.to_thread(_write_file)

    # Upsert
    if settings:
        settings.logo_filename = safe_name
    else:
        settings = CompanySettings(factory_id=fid, logo_filename=safe_name)
        db.add(settings)

    await log_audit(
        db,
        action="company_logo_uploaded",
        resource_type="company_settings",
        resource_id=str(fid),
        user_id=admin.id,
        detail=f"Logo uploaded: {safe_name}",
    )
    await db.commit()

    return {"logo_url": "/api/v1/company/logo", "filename": safe_name}


@admin_router.delete("/company-logo")
async def delete_company_logo(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Remove the company logo."""
    fid = require_factory(admin)

    result = await db.execute(
        select(CompanySettings).where(CompanySettings.factory_id == fid)
    )
    settings = result.scalar_one_or_none()

    if not settings or not settings.logo_filename:
        raise HTTPException(404, "No logo configured.")

    # Delete file
    file_path = os.path.join(LOGO_UPLOAD_DIR, settings.logo_filename)
    if os.path.exists(file_path):
        await asyncio.to_thread(os.remove, file_path)

    settings.logo_filename = None

    await log_audit(
        db,
        action="company_logo_deleted",
        resource_type="company_settings",
        resource_id=str(fid),
        user_id=admin.id,
    )
    await db.commit()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Public router — serve logo (any authenticated user)
# ---------------------------------------------------------------------------

public_router = APIRouter(prefix="/company", tags=["company"])


@public_router.get("/settings")
async def get_company_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get company settings (audit label, email config, etc.)."""
    fid = require_factory(user)
    result = await db.execute(
        select(CompanySettings).where(CompanySettings.factory_id == fid)
    )
    settings = result.scalar_one_or_none()
    return {
        "audit_label": (settings.audit_label if settings and settings.audit_label else "6S"),
        "company_display_name": (settings.company_display_name if settings else None),
        "email_reports_enabled": (settings.email_reports_enabled if settings else False),
        "daily_oee_recipients": (settings.daily_oee_recipients if settings else []),
        "weekly_kaizen_recipients": (settings.weekly_kaizen_recipients if settings else []),
        "report_timezone": (settings.report_timezone if settings and settings.report_timezone else "UTC"),
    }


@admin_router.put("/company-settings")
async def update_company_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update company settings (audit label, display name, email config)."""
    fid = require_factory(admin)

    result = await db.execute(
        select(CompanySettings).where(CompanySettings.factory_id == fid)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        settings = CompanySettings(factory_id=fid)
        db.add(settings)

    allowed = {
        "audit_label", "company_display_name",
        "email_reports_enabled", "daily_oee_recipients",
        "weekly_kaizen_recipients", "report_timezone",
    }
    for key, value in payload.items():
        if key in allowed:
            # Validate audit_label
            if key == "audit_label" and value not in ("5S", "6S"):
                from fastapi import HTTPException as HE
                raise HE(400, "audit_label must be '5S' or '6S'")
            setattr(settings, key, value)

    await log_audit(
        db,
        action="company_settings_updated",
        resource_type="company_settings",
        resource_id=str(fid),
        user_id=admin.id,
        detail=f"Updated keys: {list(payload.keys())}",
    )
    await db.commit()

    return {"ok": True}


@public_router.get("/logo")
async def get_company_logo(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve the company logo for the current user's factory."""
    fid = require_factory(user)

    result = await db.execute(
        select(CompanySettings).where(CompanySettings.factory_id == fid)
    )
    settings = result.scalar_one_or_none()

    if not settings or not settings.logo_filename:
        raise HTTPException(404, "No logo configured.")

    # Prevent path traversal — use only the basename of the stored filename
    safe_filename = os.path.basename(settings.logo_filename)
    file_path = os.path.join(LOGO_UPLOAD_DIR, safe_filename)
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(os.path.realpath(LOGO_UPLOAD_DIR)):
        raise HTTPException(403, "Invalid file path")
    if not os.path.exists(file_path):
        raise HTTPException(404, "Logo file not found.")

    # Detect MIME from extension
    ext = os.path.splitext(settings.logo_filename)[1].lower()
    mime_type = MIME_BY_EXT.get(ext, "application/octet-stream")

    response = FileResponse(file_path, media_type=mime_type)
    # Override SecurityHeadersMiddleware no-store for this static asset
    response.headers["Cache-Control"] = "public, max-age=3600"
    return response
