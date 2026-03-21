"""Quality Control API routes — Defect Catalog, QC Templates, Records, NCR, CAPA, Policy Docs."""

import asyncio
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory, require_role
from app.models.user import User
from app.schemas.qc import (
    DefectCatalogCreate, DefectCatalogUpdate, DefectCatalogResponse,
    QCTemplateCreate, QCTemplateResponse,
    QCRecordCreate, QCCheckResultCreate, QCRecordResponse,
    NCRCreate, NCRUpdate, NCRResponse,
    CAPACreate, CAPAUpdate, CAPAResponse,
)
from app.services.qc_service import (
    DefectCatalogService, QCTemplateService, QCRecordService,
    NCRService, CAPAService,
)

router = APIRouter(prefix="/qc", tags=["quality-control"])


# ─── Defect Catalog ───────────────────────────────────────────────────────────


@router.post("/defects", response_model=DefectCatalogResponse)
async def create_defect(
    data: DefectCatalogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await DefectCatalogService.create(db, fid, data.model_dump())


@router.get("/defects")
async def list_defects(
    product_id: int | None = None,
    line_id: int | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    defects = await DefectCatalogService.list_all(db, fid, product_id, line_id, active_only)
    return [DefectCatalogResponse.model_validate(d) for d in defects]


@router.patch("/defects/{defect_id}", response_model=DefectCatalogResponse)
async def update_defect(
    defect_id: int,
    data: DefectCatalogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    defect = await DefectCatalogService.update(db, defect_id, fid, data.model_dump(exclude_unset=True))
    if not defect:
        raise HTTPException(404, "Defect type not found")
    return defect


@router.delete("/defects/{defect_id}")
async def deactivate_defect(
    defect_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    defect = await DefectCatalogService.deactivate(db, defect_id, fid)
    if not defect:
        raise HTTPException(404, "Defect type not found")
    return {"ok": True}


# ─── QC Templates ────────────────────────────────────────────────────────────


@router.post("/templates", response_model=QCTemplateResponse)
async def create_template(
    data: QCTemplateCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await QCTemplateService.create(db, fid, user.id, data.model_dump())


@router.get("/templates")
async def list_templates(
    template_type: str | None = None,
    product_id: int | None = None,
    line_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    templates = await QCTemplateService.list_all(db, fid, template_type, product_id, line_id)
    return [QCTemplateResponse.model_validate(t) for t in templates]


@router.get("/templates/{template_id}", response_model=QCTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    template = await QCTemplateService.get(db, template_id, fid)
    if not template:
        raise HTTPException(404, "QC template not found")
    return template


@router.post("/templates/{template_id}/clone", response_model=QCTemplateResponse)
async def clone_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    template = await QCTemplateService.clone(db, template_id, fid, user.id)
    if not template:
        raise HTTPException(404, "QC template not found")
    return template


# ─── QC Records ───────────────────────────────────────────────────────────────


@router.post("/records", response_model=QCRecordResponse)
async def start_qc_check(
    data: QCRecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await QCRecordService.start_check(db, fid, user.id, data.model_dump())


@router.get("/records")
async def list_qc_records(
    check_type: str | None = None,
    order_id: int | None = None,
    line_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    records = await QCRecordService.list_all(db, fid, check_type, order_id, line_id)
    return [QCRecordResponse.model_validate(r) for r in records]


@router.get("/records/{record_id}", response_model=QCRecordResponse)
async def get_qc_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await QCRecordService.get(db, record_id, fid)
    if not record:
        raise HTTPException(404, "QC record not found")
    return record


@router.post("/records/{record_id}/results")
async def submit_results(
    record_id: int,
    results: list[QCCheckResultCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await QCRecordService.submit_results(
        db, record_id, fid, [r.model_dump() for r in results],
    )
    if not record:
        raise HTTPException(404, "QC record not found")
    return QCRecordResponse.model_validate(record)


@router.post("/records/{record_id}/complete", response_model=QCRecordResponse)
async def complete_qc_check(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await QCRecordService.complete_check(db, record_id, fid)
    if not record:
        raise HTTPException(404, "QC record not found")
    return record


@router.post("/records/{record_id}/void")
async def void_qc_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("line_supervisor")),
):
    fid = require_factory(user)
    record = await QCRecordService.get(db, record_id, fid)
    if not record:
        raise HTTPException(404, "QC record not found")
    record.status = "voided"
    await db.commit()
    return {"ok": True}


# ─── NCR ──────────────────────────────────────────────────────────────────────


@router.post("/ncr", response_model=NCRResponse)
async def create_ncr(
    data: NCRCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await NCRService.create(db, fid, user.id, data.model_dump())


@router.get("/ncr")
async def list_ncrs(
    status: str | None = None,
    severity: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    ncrs = await NCRService.list_all(db, fid, status, severity)
    return [NCRResponse.model_validate(n) for n in ncrs]


@router.get("/ncr/{ncr_id}", response_model=NCRResponse)
async def get_ncr(
    ncr_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    ncr = await NCRService.get(db, ncr_id, fid)
    if not ncr:
        raise HTTPException(404, "NCR not found")
    return ncr


@router.patch("/ncr/{ncr_id}", response_model=NCRResponse)
async def update_ncr(
    ncr_id: int,
    data: NCRUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    ncr = await NCRService.update(db, ncr_id, fid, user.id, data.model_dump(exclude_unset=True))
    if not ncr:
        raise HTTPException(404, "NCR not found")
    return ncr


@router.post("/ncr/{ncr_id}/link-five-why/{analysis_id}")
async def link_five_why(
    ncr_id: int,
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    ncr = await NCRService.get(db, ncr_id, fid)
    if not ncr:
        raise HTTPException(404, "NCR not found")
    # Verify the linked analysis belongs to the same factory (prevent cross-tenant FK)
    from app.models.lean import FiveWhyAnalysis
    analysis_result = await db.execute(
        select(FiveWhyAnalysis).where(FiveWhyAnalysis.id == analysis_id, FiveWhyAnalysis.factory_id == fid)
    )
    if not analysis_result.scalar_one_or_none():
        raise HTTPException(404, "5-Why analysis not found in your factory")
    ncr.five_why_id = analysis_id
    await db.commit()
    return {"ok": True}


# ─── CAPA ─────────────────────────────────────────────────────────────────────


@router.post("/capa", response_model=CAPAResponse)
async def create_capa(
    data: CAPACreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await CAPAService.create(db, fid, user.id, data.model_dump())


@router.get("/capa")
async def list_capas(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    capas = await CAPAService.list_all(db, fid, status)
    return [CAPAResponse.model_validate(c) for c in capas]


@router.get("/capa/{capa_id}", response_model=CAPAResponse)
async def get_capa(
    capa_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    capa = await CAPAService.get(db, capa_id, fid)
    if not capa:
        raise HTTPException(404, "CAPA not found")
    return capa


@router.patch("/capa/{capa_id}", response_model=CAPAResponse)
async def update_capa(
    capa_id: int,
    data: CAPAUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    capa = await CAPAService.update(db, capa_id, fid, data.model_dump(exclude_unset=True))
    if not capa:
        raise HTTPException(404, "CAPA not found")
    return capa


@router.post("/capa/{capa_id}/verify")
async def verify_capa(
    capa_id: int,
    effectiveness: str = "Effective",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    capa = await CAPAService.verify(db, capa_id, fid, user.id, effectiveness)
    if not capa:
        raise HTTPException(404, "CAPA not found")
    return CAPAResponse.model_validate(capa)


@router.post("/capa/{capa_id}/link-kaizen/{kaizen_id}")
async def link_kaizen(
    capa_id: int,
    kaizen_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    capa = await CAPAService.get(db, capa_id, fid)
    if not capa:
        raise HTTPException(404, "CAPA not found")
    # Verify the linked kaizen belongs to the same factory (prevent cross-tenant FK)
    from app.models.lean import KaizenItem
    kaizen_result = await db.execute(
        select(KaizenItem).where(KaizenItem.id == kaizen_id, KaizenItem.factory_id == fid)
    )
    if not kaizen_result.scalar_one_or_none():
        raise HTTPException(404, "Kaizen item not found in your factory")
    capa.kaizen_item_id = kaizen_id
    await db.commit()
    return {"ok": True}


# ─── QC Policy Documents ────────────────────────────────────────────────────

UPLOAD_DIR = "/app/uploads/qc_policies"
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/policies")
async def upload_policy_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("policy"),
    version: str = Form("1.0"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a QC policy document (PDF, Word, JPEG, PNG)."""
    from app.models.qc import QCPolicyDocument

    fid = require_factory(user)

    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type not allowed. Accepted: PDF, Word, JPEG, PNG")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Maximum 20 MB.")

    await asyncio.to_thread(os.makedirs, UPLOAD_DIR, exist_ok=True)
    ext = ALLOWED_TYPES[file.content_type]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)

    def _write_file():
        with open(file_path, "wb") as f:
            f.write(contents)

    await asyncio.to_thread(_write_file)

    doc = QCPolicyDocument(
        factory_id=fid,
        uploaded_by_id=user.id,
        title=title,
        description=description or None,
        category=category or "policy",
        filename=file.filename or safe_name,
        file_path=safe_name,
        file_size=len(contents),
        mime_type=file.content_type,
        version=version or "1.0",
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
        "version": doc.version,
        "created_at": str(doc.created_at),
    }


@router.get("/policies")
async def list_policy_documents(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all QC policy documents."""
    from app.models.qc import QCPolicyDocument

    fid = require_factory(user)
    query = select(QCPolicyDocument).where(
        QCPolicyDocument.factory_id == fid,
        QCPolicyDocument.is_active == True,
    )
    if category:
        query = query.where(QCPolicyDocument.category == category)
    query = query.order_by(QCPolicyDocument.category, QCPolicyDocument.title)
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
            "version": d.version,
            "created_at": str(d.created_at),
        }
        for d in docs
    ]


@router.get("/policies/{doc_id}/download")
async def download_policy_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download a QC policy document."""
    from app.models.qc import QCPolicyDocument

    fid = require_factory(user)
    result = await db.execute(
        select(QCPolicyDocument).where(
            QCPolicyDocument.id == doc_id,
            QCPolicyDocument.factory_id == fid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.file_path)
    resolved = os.path.realpath(file_path)
    if not resolved.startswith(os.path.realpath(UPLOAD_DIR)):
        raise HTTPException(403, "Invalid file path")
    if not os.path.exists(resolved):
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        resolved,
        media_type=doc.mime_type,
        filename=doc.filename,
    )


@router.delete("/policies/{doc_id}")
async def delete_policy_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Soft-delete a QC policy document."""
    from app.models.qc import QCPolicyDocument

    fid = require_factory(user)
    result = await db.execute(
        select(QCPolicyDocument).where(
            QCPolicyDocument.id == doc_id,
            QCPolicyDocument.factory_id == fid,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    doc.is_active = False
    await db.commit()
    return {"ok": True}


# ─── NCR / CAPA Photo Uploads ───────────────────────────────────────────────

from app.services.upload_service import save_upload, resolve_upload_path, IMAGE_TYPES


@router.post("/ncr/{ncr_id}/photo")
async def upload_ncr_photo(
    ncr_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a photo for a Non-Conformance Report."""
    from app.models.qc import NonConformanceReport
    fid = require_factory(user)

    result = await db.execute(
        select(NonConformanceReport).where(
            NonConformanceReport.id == ncr_id,
            NonConformanceReport.factory_id == fid,
        )
    )
    ncr = result.scalar_one_or_none()
    if not ncr:
        raise HTTPException(404, "NCR not found")

    relative_path, file_size = await save_upload(file, "ncr", fid, IMAGE_TYPES)
    ncr.photo_url = relative_path
    await db.commit()
    return {"photo_url": f"/api/v1/qc/ncr/{ncr_id}/photo", "file_size": file_size}


@router.get("/ncr/{ncr_id}/photo")
async def get_ncr_photo(
    ncr_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve an NCR photo."""
    from app.models.qc import NonConformanceReport
    fid = require_factory(user)

    result = await db.execute(
        select(NonConformanceReport).where(
            NonConformanceReport.id == ncr_id,
            NonConformanceReport.factory_id == fid,
        )
    )
    ncr = result.scalar_one_or_none()
    if not ncr or not ncr.photo_url:
        raise HTTPException(404, "Photo not found")

    disk_path = resolve_upload_path("ncr", ncr.photo_url)
    ext = os.path.splitext(disk_path)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return FileResponse(disk_path, media_type=mime)


@router.post("/capa/{capa_id}/photo")
async def upload_capa_photo(
    capa_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a photo for a CAPA action."""
    from app.models.qc import CAPAAction
    fid = require_factory(user)

    result = await db.execute(
        select(CAPAAction).where(
            CAPAAction.id == capa_id,
            CAPAAction.factory_id == fid,
        )
    )
    capa = result.scalar_one_or_none()
    if not capa:
        raise HTTPException(404, "CAPA not found")

    relative_path, file_size = await save_upload(file, "capa", fid, IMAGE_TYPES)
    capa.photo_url = relative_path
    await db.commit()
    return {"photo_url": f"/api/v1/qc/capa/{capa_id}/photo", "file_size": file_size}


@router.get("/capa/{capa_id}/photo")
async def get_capa_photo(
    capa_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve a CAPA photo."""
    from app.models.qc import CAPAAction
    fid = require_factory(user)

    result = await db.execute(
        select(CAPAAction).where(
            CAPAAction.id == capa_id,
            CAPAAction.factory_id == fid,
        )
    )
    capa = result.scalar_one_or_none()
    if not capa or not capa.photo_url:
        raise HTTPException(404, "Photo not found")

    disk_path = resolve_upload_path("capa", capa.photo_url)
    ext = os.path.splitext(disk_path)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return FileResponse(disk_path, media_type=mime)
