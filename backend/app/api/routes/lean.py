from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
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


@router.get("/five-why", response_model=list[FiveWhyResponse])
async def list_five_why(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await FiveWhyService.list_by_factory(db, fid)


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
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await IshikawaService.list_by_factory(db, fid)


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


@router.get("/kaizen/board")
async def get_kaizen_board(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await KaizenService.get_board(db, fid)


@router.patch("/kaizen/{kaizen_id}/status")
async def update_kaizen_status(
    kaizen_id: int,
    new_status: str,
    actual_savings: float | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    # Ownership check: KaizenService.update_status must validate factory_id
    item = await KaizenService.update_status(db, kaizen_id, new_status, actual_savings, factory_id=fid)
    return {
        "id": item.id,
        "status": str(item.status).lower() if item.status else item.status,
        "title": item.title,
        "actual_savings_eur": item.actual_savings_eur,
        "expected_savings_eur": item.expected_savings_eur,
    }


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


@router.get("/assessment")
async def list_lean_assessments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all assessments for this factory."""
    from sqlalchemy import select
    from app.models.lean import LeanAssessment
    fid = require_factory(user)
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


@router.get("/assessment/latest")
async def get_latest_assessment(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the most recent assessment for this factory. Returns camelCase for frontend."""
    from sqlalchemy import select
    from app.models.lean import LeanAssessment
    fid = require_factory(user)
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
        "overallLevel": int(assessment.maturity_level) if assessment.maturity_level.isdigit() else 1,
        "completedAt": assessment.created_at.isoformat() if assessment.created_at else "",
    }
