from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.horizontal_deploy import HorizontalDeployment
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/horizontal-deploy", tags=["horizontal-deploy"])


# --- Schemas ---

class HorizontalDeployCreate(BaseModel):
    source_type: str  # five_why, kaizen, ncr
    source_id: int
    target_lines: list[int]
    description: str


class LineCompleteRequest(BaseModel):
    line_id: int
    notes: str = ""


class HorizontalDeployResponse(BaseModel):
    id: int
    factory_id: int
    source_type: str
    source_id: int
    description: str
    target_lines: list
    completed_lines: list
    deployed_by_id: int | None
    status: str
    created_at: datetime | None
    updated_at: datetime | None

    class Config:
        from_attributes = True


# --- Routes ---

@router.post("", response_model=HorizontalDeployResponse)
async def create_deployment(
    data: HorizontalDeployCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a horizontal deployment record."""
    fid = require_factory(user)

    if data.source_type not in ("five_why", "kaizen", "ncr"):
        raise HTTPException(status_code=400, detail="source_type must be five_why, kaizen, or ncr")

    deployment = HorizontalDeployment(
        factory_id=fid,
        source_type=data.source_type,
        source_id=data.source_id,
        target_lines=data.target_lines,
        completed_lines=[],
        description=data.description,
        deployed_by_id=user.id,
        status="open",
    )
    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    # Notify factory via WebSocket
    await ws_manager.send_event(fid, "horizontal_deploy_created", {
        "id": deployment.id,
        "source_type": deployment.source_type,
        "description": deployment.description,
    })

    return deployment


@router.get("", response_model=list[HorizontalDeployResponse])
async def list_deployments(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List horizontal deployments for the user's factory."""
    fid = require_factory(user)
    result = await db.execute(
        select(HorizontalDeployment)
        .where(HorizontalDeployment.factory_id == fid)
        .order_by(HorizontalDeployment.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{deployment_id}", response_model=HorizontalDeployResponse)
async def get_deployment(
    deployment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single horizontal deployment."""
    fid = require_factory(user)
    result = await db.execute(
        select(HorizontalDeployment)
        .where(
            HorizontalDeployment.id == deployment_id,
            HorizontalDeployment.factory_id == fid,
        )
    )
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment


@router.patch("/{deployment_id}/complete", response_model=HorizontalDeployResponse)
async def complete_line(
    deployment_id: int,
    data: LineCompleteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark a deployment as complete on a specific line."""
    fid = require_factory(user)
    result = await db.execute(
        select(HorizontalDeployment)
        .where(
            HorizontalDeployment.id == deployment_id,
            HorizontalDeployment.factory_id == fid,
        )
    )
    deployment = result.scalar_one_or_none()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    if data.line_id not in (deployment.target_lines or []):
        raise HTTPException(status_code=400, detail="Line not in target lines")

    # Check if already completed
    completed = deployment.completed_lines or []
    if any(c.get("line_id") == data.line_id for c in completed):
        raise HTTPException(status_code=400, detail="Line already marked as complete")

    completed.append({
        "line_id": data.line_id,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "completed_by": user.id,
        "notes": data.notes,
    })
    deployment.completed_lines = completed
    flag_modified(deployment, "completed_lines")

    # Auto-close if all target lines are completed
    target_set = set(deployment.target_lines or [])
    completed_set = {c["line_id"] for c in completed}
    if target_set <= completed_set:
        deployment.status = "completed"

    await db.commit()
    await db.refresh(deployment)

    # Notify factory via WebSocket
    await ws_manager.send_event(fid, "horizontal_deploy_updated", {
        "id": deployment.id,
        "status": deployment.status,
        "line_id": data.line_id,
    })

    return deployment
