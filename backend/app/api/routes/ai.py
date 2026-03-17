"""
AI Routes - PAID ADD-ON
These endpoints only work for factories with ai_enabled=True (Pro/Enterprise plan).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.user import User
from app.models.factory import Factory
from app.schemas.ai import (
    CopilotMessageRequest, CopilotMessageResponse,
    AIRootCauseRequest, AIRootCauseResponse,
)

router = APIRouter(prefix="/ai", tags=["ai-module"])
settings = get_settings()


async def _check_ai_access(user: User, db: AsyncSession):
    """Verify AI access: factory assigned + AI consent granted (GDPR Art. 6/7)."""
    if not user.factory_id:
        raise HTTPException(status_code=400, detail="User not assigned to a factory")

    # GDPR Art. 7 — AI processing requires explicit consent
    if not user.ai_consent:
        raise HTTPException(
            status_code=403,
            detail="AI features require explicit consent. "
                   "Please enable AI consent in your privacy settings.",
        )

    from sqlalchemy import select
    result = await db.execute(select(Factory).where(Factory.id == user.factory_id))
    factory = result.scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")
    return factory


@router.post("/copilot/chat", response_model=CopilotMessageResponse)
async def copilot_chat(
    data: CopilotMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Factory Copilot - chat with AI about your factory data."""
    factory = await _check_ai_access(user, db)

    from app.services.ai_engine import AIEngine
    engine = AIEngine()
    result = await engine.chat(
        db=db,
        factory_id=factory.id,
        user_id=user.id,
        message=data.message,
        conversation_id=data.conversation_id,
        line_id=data.production_line_id,
    )
    return CopilotMessageResponse(**result)


@router.post("/root-cause", response_model=AIRootCauseResponse)
async def ai_root_cause(
    data: AIRootCauseRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Root Cause AI - auto-generate 5 WHY + Ishikawa from data."""
    factory = await _check_ai_access(user, db)

    from app.services.ai_engine import AIEngine
    engine = AIEngine()
    return await engine.generate_root_cause_analysis(
        db=db,
        factory_id=factory.id,
        line_id=data.production_line_id,
        problem=data.problem_description,
    )


@router.post("/auto-kaizen")
async def auto_kaizen(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Auto Kaizen - generate improvement suggestions from data patterns."""
    factory = await _check_ai_access(user, db)

    from app.services.ai_engine import AIEngine
    engine = AIEngine()
    suggestions = await engine.generate_kaizen_suggestions(db=db, factory_id=factory.id)
    return {
        "count": len(suggestions),
        "suggestions": [
            {
                "id": s.id,
                "type": s.suggestion_type,
                "title": s.title,
                "description": s.description,
                "lean_tool": s.lean_tool,
                "confidence": s.confidence,
            }
            for s in suggestions
        ],
    }
