import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.services.upload_service import save_upload, resolve_upload_path, IMAGE_TYPES
from app.schemas.lean import (
    FiveWhyCreate, FiveWhyResponse, IshikawaCreate, IshikawaResponse,
    KaizenCreate, KaizenResponse, SMEDCreate, SMEDResponse,
)
from app.services.lean_tools import FiveWhyService, IshikawaService, KaizenService, SMEDService


class LeanAssessmentCreate(BaseModel):
    """Accept both camelCase (frontend) and snake_case formats."""
    scores: dict[str, float] = {}
    overall_score: float = 0
    maturity_level: str = ""
    recommendations: list = []
    answers: dict = {}
    # Frontend camelCase fields (optional, mapped during save)
    categoryScores: list | None = None
    overallScore: float | None = None
    overallLevel: int | str | None = None
    completedAt: str | None = None

router = APIRouter(prefix="/lean", tags=["lean"])


# --- 5 WHY ---

@router.post("/five-why")
async def create_five_why(
    data: FiveWhyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    analysis = await FiveWhyService.create(db, fid, user.id, data.model_dump())
    return {"id": analysis.id, "status": str(analysis.status).lower() if analysis.status else analysis.status}


@router.get("/five-why")
async def list_five_why(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import structlog
    fid = require_factory(user)
    try:
        analyses = await FiveWhyService.list_by_factory(db, fid, skip=skip, limit=limit)
        # Manually serialize to avoid response_model validation errors
        # when DB values have unexpected case/format
        result = []
        for a in analyses:
            status_val = a.status
            if hasattr(status_val, "value"):
                status_val = status_val.value
            if isinstance(status_val, str):
                status_val = status_val.lower()
            steps = []
            for s in (a.steps or []):
                steps.append({
                    "id": s.id,
                    "step_number": s.step_number,
                    "why_question": s.why_question,
                    "answer": s.answer,
                })
            result.append({
                "id": a.id,
                "title": a.title,
                "problem_statement": a.problem_statement,
                "status": status_val or "open",
                "root_cause": a.root_cause,
                "countermeasure": a.countermeasure,
                "responsible": a.responsible,
                "due_date": a.due_date.isoformat() if a.due_date else None,
                "ai_generated": getattr(a, "ai_generated", False) or False,
                "steps": steps,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("five_why_list_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to list 5-Why analyses")


# --- ISHIKAWA ---

@router.post("/ishikawa")
async def create_ishikawa(
    data: IshikawaCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    analysis = await IshikawaService.create(db, fid, user.id, data.model_dump())
    return {"id": analysis.id}


@router.get("/ishikawa", response_model=list[IshikawaResponse])
async def list_ishikawa(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await IshikawaService.list_by_factory(db, fid, skip=skip, limit=limit)


# --- KAIZEN ---

@router.post("/kaizen")
async def create_kaizen(
    data: KaizenCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    item = await KaizenService.create(db, fid, user.id, data.model_dump())
    return {"id": item.id, "status": str(item.status).lower() if item.status else item.status}


@router.get("/kaizen")
async def list_kaizen(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import structlog
    fid = require_factory(user)
    try:
        items = await KaizenService.list_by_factory(db, fid, skip=skip, limit=limit)
        return [KaizenService._serialize_kaizen(item) for item in items]
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("kaizen_list_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to list Kaizen items")


@router.get("/kaizen/board")
async def get_kaizen_board(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import structlog
    fid = require_factory(user)
    try:
        return await KaizenService.get_board(db, fid)
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("kaizen_board_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to load Kaizen board")


_VALID_KAIZEN_STATUSES = {"idea", "planned", "in_progress", "completed", "verified", "standardized", "rejected"}


@router.patch("/kaizen/{kaizen_id}/status")
async def update_kaizen_status(
    kaizen_id: int,
    new_status: str,
    actual_savings: float | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    if new_status.lower() not in _VALID_KAIZEN_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(_VALID_KAIZEN_STATUSES))}",
        )
    # Ownership check: KaizenService.update_status must validate factory_id
    item = await KaizenService.update_status(db, kaizen_id, new_status, actual_savings, factory_id=fid)
    return {
        "id": item.id,
        "status": str(item.status).lower() if item.status else item.status,
        "title": item.title,
        "actual_savings_eur": item.actual_savings_eur,
        "expected_savings_eur": item.expected_savings_eur,
    }


@router.post("/kaizen/sync-pareto-priorities")
async def sync_pareto_priorities(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Sync kaizen items with Pareto analysis: assign pareto_rank based on top defects."""
    from sqlalchemy import select, func, update
    from app.models.lean import KaizenItem
    from app.models.production import ScrapRecord
    from app.models.factory import ProductionLine
    from app.models.qc import NonConformanceReport
    from app.models.waste import WasteEvent

    fid = require_factory(user)

    try:
        # Reset all existing pareto ranks for this factory
        await db.execute(
            update(KaizenItem)
            .where(KaizenItem.factory_id == fid)
            .values(pareto_rank=None)
        )

        # Aggregate top defect categories from NCRs
        ncr_cats = await db.execute(
            select(
                NonConformanceReport.title,
                func.count(NonConformanceReport.id).label("cnt"),
            )
            .where(NonConformanceReport.factory_id == fid)
            .group_by(NonConformanceReport.title)
            .order_by(func.count(NonConformanceReport.id).desc())
            .limit(10)
        )
        top_defects_ncr = ncr_cats.all()

        # Aggregate top scrap categories (join through production_line for factory scoping)
        scrap_cats = await db.execute(
            select(
                ScrapRecord.defect_type,
                func.count(ScrapRecord.id).label("cnt"),
            )
            .join(ProductionLine, ScrapRecord.production_line_id == ProductionLine.id)
            .where(ProductionLine.factory_id == fid)
            .group_by(ScrapRecord.defect_type)
            .order_by(func.count(ScrapRecord.id).desc())
            .limit(10)
        )
        top_defects_scrap = scrap_cats.all()

        # Aggregate top waste categories
        waste_cats = await db.execute(
            select(
                WasteEvent.waste_type,
                func.count(WasteEvent.id).label("cnt"),
            )
            .where(WasteEvent.factory_id == fid)
            .group_by(WasteEvent.waste_type)
            .order_by(func.count(WasteEvent.id).desc())
            .limit(10)
        )
        top_defects_waste = waste_cats.all()

        # Combine and rank top 3
        combined = {}
        for row in top_defects_ncr:
            key = (row[0] or "").lower().strip()
            if key:
                combined[key] = combined.get(key, 0) + row[1]
        for row in top_defects_scrap:
            key = (row[0] or "").lower().strip()
            if key:
                combined[key] = combined.get(key, 0) + row[1]
        for row in top_defects_waste:
            key = (row[0] or "").lower().strip()
            if key:
                combined[key] = combined.get(key, 0) + row[1]

        # Sort by count descending and pick top 3
        sorted_defects = sorted(combined.items(), key=lambda x: x[1], reverse=True)[:3]

        if not sorted_defects:
            await db.commit()
            return {"updated_count": 0, "top_defects": []}

        # For each top defect, find matching kaizen items by title/description/category
        updated_count = 0
        top_defect_info = []
        for rank, (defect_key, defect_count) in enumerate(sorted_defects, 1):
            top_defect_info.append({"rank": rank, "defect": defect_key, "count": defect_count})

            # Find kaizen items whose title, description, or category matches the defect key
            kaizen_result = await db.execute(
                select(KaizenItem)
                .where(
                    KaizenItem.factory_id == fid,
                    func.lower(KaizenItem.status).notin_(["rejected", "standardized"]),
                )
                .where(
                    func.lower(KaizenItem.title).contains(defect_key)
                    | func.lower(KaizenItem.description).contains(defect_key)
                    | func.lower(KaizenItem.category).contains(defect_key)
                )
            )
            matching_items = kaizen_result.scalars().all()
            for item in matching_items:
                if item.pareto_rank is None or item.pareto_rank > rank:
                    item.pareto_rank = rank
                    updated_count += 1

        await db.flush()
        await db.commit()
        return {"updated_count": updated_count, "top_defects": top_defect_info}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        structlog.get_logger().error("pareto_sync_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to sync Pareto priorities")


@router.get("/kaizen/savings")
async def get_kaizen_savings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await KaizenService.get_savings_summary(db, fid)


# --- SMED ---

@router.post("/smed")
async def create_smed(
    data: SMEDCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await SMEDService.create(db, fid, user.id, data.model_dump())
    return {"id": record.id}


@router.get("/smed", response_model=list[SMEDResponse])
async def list_smed(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SMEDService.list_by_factory(db, fid, skip=skip, limit=limit)


@router.get("/smed/{record_id}/potential", response_model=SMEDResponse)
async def get_smed_potential(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SMEDService.get_improvement_potential(db, record_id, factory_id=fid)


# --- FIVE-WHY GET BY ID ---

@router.get("/five-why/{analysis_id}", response_model=FiveWhyResponse)
async def get_five_why(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await FiveWhyService.get_by_id(db, analysis_id, factory_id=fid)
    if not result:
        raise HTTPException(status_code=404, detail="5 Why analysis not found")
    return result


@router.delete("/five-why/{analysis_id}")
async def delete_five_why(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await FiveWhyService.delete(db, analysis_id, factory_id=fid)
    return {"status": "deleted"}


# --- ISHIKAWA GET BY ID & DELETE ---

@router.get("/ishikawa/{analysis_id}", response_model=IshikawaResponse)
async def get_ishikawa(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await IshikawaService.get_by_id(db, analysis_id, factory_id=fid)
    if not result:
        raise HTTPException(status_code=404, detail="Ishikawa analysis not found")
    return result


@router.delete("/ishikawa/{analysis_id}")
async def delete_ishikawa(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    await IshikawaService.delete(db, analysis_id, factory_id=fid)
    return {"status": "deleted"}


# --- LEAN ASSESSMENT ---

@router.post("/assessment")
async def save_lean_assessment(
    data: LeanAssessmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save lean maturity assessment results."""
    from app.models.lean import LeanAssessment
    fid = require_factory(user)

    # Map camelCase frontend fields to snake_case DB fields
    scores = data.scores
    overall_score = data.overall_score
    maturity_level = data.maturity_level
    recommendations = data.recommendations or []
    answers = data.answers

    # If frontend sent camelCase fields, use those
    if data.categoryScores:
        scores = {cs.get("id", ""): cs.get("score", 0) for cs in data.categoryScores if isinstance(cs, dict)}
    if data.overallScore is not None:
        overall_score = data.overallScore
    if data.overallLevel is not None:
        maturity_level = str(data.overallLevel)

    try:
        assessment = LeanAssessment(
            factory_id=fid,
            assessed_by_id=user.id,
            scores=scores,
            overall_score=overall_score,
            maturity_level=maturity_level,
            recommendations=data.categoryScores or recommendations,  # Store full category data
            answers=answers,
        )
        db.add(assessment)
        await db.flush()
        await db.commit()
        return {"id": assessment.id, "overall_score": assessment.overall_score}
    except Exception as e:
        await db.rollback()
        structlog.get_logger().error("assessment_save_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to save assessment")


@router.get("/assessment")
async def list_lean_assessments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all assessments for this factory."""
    from sqlalchemy import select
    from app.models.lean import LeanAssessment
    fid = require_factory(user)
    try:
        result = await db.execute(
            select(LeanAssessment)
            .where(LeanAssessment.factory_id == fid)
            .order_by(LeanAssessment.created_at.desc())
        )
        assessments = result.scalars().all()
        return [
            {
                "id": a.id,
                "overallScore": a.overall_score,
                "maturityLevel": a.maturity_level,
                "completedAt": a.created_at.isoformat() if a.created_at else "",
            }
            for a in assessments
        ]
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("assessment_list_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to list assessments")


@router.get("/assessment/auto-score")
async def get_auto_score(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compute lean maturity auto-score from actual tool usage in the last 90 days.

    Uses LeanMaturityCalculator to evaluate 12 categories with quality-aware scoring.
    """
    from app.services.lean_maturity import LeanMaturityCalculator

    fid = require_factory(user)
    try:
        calculator = LeanMaturityCalculator(db, fid, period_days=90)
        return await calculator.compute()
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("auto_score_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to compute auto-score")


@router.get("/assessment/latest")
async def get_latest_assessment(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the most recent assessment for this factory. Returns camelCase for frontend."""
    from sqlalchemy import select
    from app.models.lean import LeanAssessment
    fid = require_factory(user)
    try:
        result = await db.execute(
            select(LeanAssessment)
            .where(LeanAssessment.factory_id == fid)
            .order_by(LeanAssessment.created_at.desc())
            .limit(1)
        )
        assessment = result.scalar_one_or_none()
        if not assessment:
            return None

        # Return in frontend-expected camelCase format
        category_scores = assessment.recommendations if isinstance(assessment.recommendations, list) else []
        # If recommendations stored as category scores (list of dicts with id/score/level)
        if category_scores and isinstance(category_scores[0], dict) and "id" in category_scores[0]:
            pass  # Already in the right format
        else:
            # Build categoryScores from scores dict
            category_scores = [
                {"id": k, "titleKey": f"cat{k.capitalize()}", "score": v, "level": int(v)}
                for k, v in (assessment.scores or {}).items()
            ]

        return {
            "answers": assessment.answers or {},
            "categoryScores": category_scores,
            "overallScore": assessment.overall_score,
            "overallLevel": int(assessment.maturity_level) if assessment.maturity_level and assessment.maturity_level.isdigit() else 1,
            "completedAt": assessment.created_at.isoformat() if assessment.created_at else "",
        }
    except HTTPException:
        raise
    except Exception as e:
        structlog.get_logger().error("assessment_load_failed", error=str(e), factory_id=fid)
        raise HTTPException(status_code=500, detail="Failed to load assessment")


# --- KAIZEN PHOTO UPLOAD ---

@router.post("/kaizen/{kaizen_id}/photo/{photo_type}")
async def upload_kaizen_photo(
    kaizen_id: int,
    photo_type: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a before or after photo for a kaizen item."""
    if photo_type not in ("before", "after"):
        raise HTTPException(400, "photo_type must be 'before' or 'after'")

    from app.models.lean import KaizenItem
    fid = require_factory(user)

    result = await db.execute(
        select(KaizenItem).where(KaizenItem.id == kaizen_id, KaizenItem.factory_id == fid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Kaizen item not found")

    relative_path, file_size = await save_upload(file, "kaizen", fid, IMAGE_TYPES, 10 * 1024 * 1024)

    if photo_type == "before":
        item.before_photo_url = relative_path
    else:
        item.after_photo_url = relative_path

    await db.commit()
    return {"photo_url": f"/api/v1/lean/kaizen/{kaizen_id}/photo/{photo_type}", "file_size": file_size}


@router.get("/kaizen/{kaizen_id}/photo/{photo_type}")
async def get_kaizen_photo(
    kaizen_id: int,
    photo_type: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Serve a kaizen before/after photo."""
    if photo_type not in ("before", "after"):
        raise HTTPException(400, "photo_type must be 'before' or 'after'")

    from app.models.lean import KaizenItem
    fid = require_factory(user)

    result = await db.execute(
        select(KaizenItem).where(KaizenItem.id == kaizen_id, KaizenItem.factory_id == fid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Kaizen item not found")

    photo_url = item.before_photo_url if photo_type == "before" else item.after_photo_url
    if not photo_url:
        raise HTTPException(404, "No photo uploaded")

    disk_path = resolve_upload_path("kaizen", photo_url)
    import os
    ext = os.path.splitext(disk_path)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}.get(ext, "application/octet-stream")
    return FileResponse(disk_path, media_type=mime)
