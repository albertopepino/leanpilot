"""Safety Incident Tracking — log, list, update, and analyse safety events."""
import os
import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import structlog

from app.db.session import get_db
from app.core.security import get_current_user, require_factory, require_role
from app.models.safety import SafetyIncident, SafetyDocument
from app.models.lean_advanced import AndonEvent
from app.schemas.safety import (
    SafetyIncidentCreate, SafetyIncidentUpdate, SafetyIncidentResponse,
)
from app.services.upload_service import save_upload, resolve_upload_path, IMAGE_TYPES
from app.services import storage as storage_svc

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/safety", tags=["Safety"])


@router.post("/incidents", response_model=SafetyIncidentResponse)
async def create_incident(
    data: SafetyIncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fid = require_factory(current_user)
    incident = SafetyIncident(
        factory_id=fid,
        created_by_id=current_user.id,
        **data.model_dump(),
    )
    db.add(incident)
    await db.flush()

    andon_event_id = None

    # Critical safety incident → auto-create Andon Safety Hold + notifications
    if data.severity == "critical" and data.production_line_id:
        try:
            andon = AndonEvent(
                factory_id=fid,
                production_line_id=data.production_line_id,
                triggered_by_id=current_user.id,
                status="red",
                reason="safety_hold",
                description=f"Safety Hold: {data.title}",
                source="safety",
                trigger_type="safety_critical",
                safety_incident_id=incident.id,
            )
            db.add(andon)
            await db.flush()
            andon_event_id = andon.id

            # Notify supervisors and managers
            from app.services.notification_service import notify_factory_role
            from app.models.factory import ProductionLine

            line_q = select(ProductionLine.name).where(ProductionLine.id == data.production_line_id)
            line_r = await db.execute(line_q)
            line_name = line_r.scalar() or f"Line {data.production_line_id}"

            notif_title = f"SAFETY HOLD: {data.title}"
            notif_msg = f"Critical safety incident on {line_name}. Andon Safety Hold triggered. Production stopped."

            for role in ("line_supervisor", "plant_manager", "production_manager"):
                await notify_factory_role(
                    db,
                    factory_id=fid,
                    role=role,
                    notification_type="andon_triggered",
                    title=notif_title,
                    message=notif_msg,
                    priority="critical",
                    link="/respond/andon",
                    source_type="safety_incident",
                    source_id=incident.id,
                )
        except Exception as e:
            logger.error("safety_andon_integration_failed", error=str(e), incident_id=incident.id)
            # Don't fail the incident creation if integration fails

    await db.commit()
    await db.refresh(incident)

    # Attach andon_event_id as a transient attribute for the response
    incident.andon_event_id = andon_event_id  # type: ignore[attr-defined]
    return incident


@router.get("/incidents", response_model=list[SafetyIncidentResponse])
async def list_incidents(
    incident_type: str = Query(None),
    severity: str = Query(None),
    status: str = Query(None),
    line_id: int = Query(None),
    date_from: date = Query(None),
    date_to: date = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = select(SafetyIncident).where(SafetyIncident.factory_id == require_factory(current_user))
    if incident_type:
        q = q.where(SafetyIncident.incident_type == incident_type)
    if severity:
        q = q.where(SafetyIncident.severity == severity)
    if status:
        q = q.where(SafetyIncident.status == status)
    if line_id:
        q = q.where(SafetyIncident.production_line_id == line_id)
    if date_from:
        q = q.where(SafetyIncident.date >= date_from)
    if date_to:
        q = q.where(SafetyIncident.date <= date_to)
    q = q.order_by(SafetyIncident.date.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/incidents/{incident_id}", response_model=SafetyIncidentResponse)
async def update_incident(
    incident_id: int,
    data: SafetyIncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(SafetyIncident).where(
            SafetyIncident.id == incident_id,
            SafetyIncident.factory_id == require_factory(current_user),
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(incident, k, v)
    await db.commit()
    await db.refresh(incident)
    return incident


@router.delete("/incidents/{incident_id}")
async def delete_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("line_supervisor")),
):
    result = await db.execute(
        select(SafetyIncident).where(
            SafetyIncident.id == incident_id,
            SafetyIncident.factory_id == require_factory(current_user),
        )
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")
    await db.delete(incident)
    await db.commit()
    return {"ok": True}


@router.get("/stats")
async def get_stats(
    line_id: int = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    fid = require_factory(current_user)
    base_where = [SafetyIncident.factory_id == fid]
    if line_id:
        base_where.append(SafetyIncident.production_line_id == line_id)

    # Total count via SQL
    total_result = await db.execute(
        select(func.count(SafetyIncident.id)).where(*base_where)
    )
    total = total_result.scalar() or 0

    # Open count via SQL
    open_result = await db.execute(
        select(func.count(SafetyIncident.id)).where(
            *base_where,
            SafetyIncident.status.in_(("open", "investigating")),
        )
    )
    open_count = open_result.scalar() or 0

    # Days without incident — only need the most recent date
    today = date.today()
    last_date_result = await db.execute(
        select(func.max(SafetyIncident.date)).where(*base_where)
    )
    last_date = last_date_result.scalar()
    days_without = (today - last_date).days if last_date else 0

    # Count by type via SQL GROUP BY
    type_result = await db.execute(
        select(SafetyIncident.incident_type, func.count(SafetyIncident.id))
        .where(*base_where)
        .group_by(SafetyIncident.incident_type)
    )
    by_type = {row[0]: row[1] for row in type_result.all()}

    # Count by severity via SQL GROUP BY
    sev_result = await db.execute(
        select(SafetyIncident.severity, func.count(SafetyIncident.id))
        .where(*base_where)
        .group_by(SafetyIncident.severity)
    )
    by_severity = {row[0]: row[1] for row in sev_result.all()}

    return {
        "days_without_incident": days_without,
        "total_incidents": total,
        "open_count": open_count,
        "by_type": by_type,
        "by_severity": by_severity,
    }


# ─── Safety Documents ────────────────────────────────────────────────────────

SAFETY_UPLOAD_DIR = os.environ.get("UPLOAD_BASE_DIR", "/app/uploads") + "/safety"
SAFETY_ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "text/plain": ".txt",
}
SAFETY_MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/documents")
async def upload_safety_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("SOP"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload a safety document (PDF, Word, Excel, PowerPoint, images, text)."""
    fid = require_factory(current_user)

    if not file.content_type or file.content_type not in SAFETY_ALLOWED_TYPES:
        raise HTTPException(400, "File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, JPEG, PNG, TXT")

    contents = await file.read()
    if len(contents) > SAFETY_MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Maximum 20 MB.")

    ext = SAFETY_ALLOWED_TYPES[file.content_type]

    safe_name = f"{uuid.uuid4().hex}{ext}"
    storage_key = storage_svc.build_key(fid, "safety", safe_name)
    await storage_svc.upload_file(contents, storage_key, file.content_type)

    relative_path = f"{fid}/{safe_name}"

    doc = SafetyDocument(
        factory_id=fid,
        uploaded_by_id=current_user.id,
        title=title,
        description=description or None,
        category=category,
        filename=file.filename or safe_name,
        file_path=relative_path,
        file_size=len(contents),
        mime_type=file.content_type,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "category": doc.category,
        "file_size": doc.file_size,
        "mime_type": doc.mime_type,
        "created_at": str(doc.created_at),
    }


@router.get("/documents")
async def list_safety_documents(
    category: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all active safety documents."""
    fid = require_factory(current_user)
    query = select(SafetyDocument).where(
        SafetyDocument.factory_id == fid,
        SafetyDocument.is_active == True,
    )
    if category:
        query = query.where(SafetyDocument.category == category)
    query = query.order_by(SafetyDocument.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    docs = result.scalars().all()

    return [
        {
            "id": d.id,
            "title": d.title,
            "description": d.description,
            "filename": d.filename,
            "category": d.category,
            "file_size": d.file_size,
            "mime_type": d.mime_type,
            "created_at": str(d.created_at),
            "updated_at": str(d.updated_at),
        }
        for d in docs
    ]


@router.get("/documents/{doc_id}/download")
async def download_safety_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Download a safety document."""
    fid = require_factory(current_user)
    result = await db.execute(
        select(SafetyDocument).where(
            SafetyDocument.id == doc_id,
            SafetyDocument.factory_id == fid,
            SafetyDocument.is_active == True,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Build storage key from DB relative path
    safe = os.path.basename(doc.file_path.split("/")[-1])
    factory_id_str = doc.file_path.split("/")[0]
    storage_key = f"{factory_id_str}/safety/{safe}"

    # Try S3 presigned download URL (with Content-Disposition: attachment)
    presigned = await storage_svc.generate_presigned_download_url(storage_key, doc.filename)
    if presigned:
        return RedirectResponse(url=presigned, status_code=302)

    # Local fallback
    try:
        file_bytes = await storage_svc.get_file_bytes(storage_key)
    except (FileNotFoundError, PermissionError):
        raise HTTPException(404, "File not found on disk")
    return Response(
        content=file_bytes,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )


@router.delete("/documents/{doc_id}")
async def delete_safety_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_role("line_supervisor")),
):
    """Soft-delete a safety document (set is_active=False)."""
    fid = require_factory(current_user)
    result = await db.execute(
        select(SafetyDocument).where(
            SafetyDocument.id == doc_id,
            SafetyDocument.factory_id == fid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.is_active = False
    await db.commit()
    return {"ok": True}


# ─── Incident Photo Upload ──────────────────────────────────────────────────


@router.post("/incidents/{incident_id}/photo")
async def upload_incident_photo(
    incident_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Upload a photo for a safety incident."""
    fid = require_factory(current_user)

    result = await db.execute(
        select(SafetyIncident).where(SafetyIncident.id == incident_id, SafetyIncident.factory_id == fid)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(404, "Incident not found")

    relative_path, file_size = await save_upload(file, "incidents", fid, IMAGE_TYPES)
    incident.photo_url = relative_path
    await db.commit()
    return {"photo_url": f"/api/v1/safety/incidents/{incident_id}/photo", "file_size": file_size}


@router.get("/incidents/{incident_id}/photo")
async def get_incident_photo(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Serve a safety incident photo."""
    fid = require_factory(current_user)

    result = await db.execute(
        select(SafetyIncident).where(SafetyIncident.id == incident_id, SafetyIncident.factory_id == fid)
    )
    incident = result.scalar_one_or_none()
    if not incident or not incident.photo_url:
        raise HTTPException(404, "Photo not found")

    # Build storage key from DB relative path
    safe = os.path.basename(incident.photo_url.split("/")[-1])
    factory_id_str = incident.photo_url.split("/")[0]
    storage_key = f"{factory_id_str}/incidents/{safe}"

    presigned = await storage_svc.generate_presigned_url(storage_key)
    if presigned:
        return RedirectResponse(url=presigned, status_code=302)

    file_bytes = await storage_svc.get_file_bytes(storage_key)
    ext = os.path.splitext(safe)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return Response(content=file_bytes, media_type=mime)
