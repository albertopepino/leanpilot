from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.models.kanban import KanbanBoard, KanbanCard
from app.models.factory import ProductionLine
from app.schemas.kanban import (
    KanbanBoardCreate, KanbanBoardUpdate, KanbanBoardResponse,
    KanbanBoardDetailResponse,
    KanbanCardCreate, KanbanCardUpdate, KanbanCardMove, KanbanCardResponse,
    KanbanMetricsResponse,
)
from app.services.kanban_service import KanbanService

router = APIRouter(prefix="/kanban", tags=["kanban"])


# ─── Board endpoints ─────────────────────────────────────────────────────────

@router.get("/boards", response_model=list[KanbanBoardResponse])
async def list_boards(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanBoard)
        .where(KanbanBoard.factory_id == fid)
        .order_by(KanbanBoard.created_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/boards", response_model=KanbanBoardResponse)
async def create_board(
    data: KanbanBoardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    board = KanbanBoard(
        factory_id=fid,
        created_by_id=user.id,
        **data.model_dump(),
    )
    db.add(board)
    await db.flush()
    await db.commit()
    await db.refresh(board)
    return board


@router.get("/boards/{board_id}", response_model=KanbanBoardDetailResponse)
async def get_board(
    board_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanBoard).where(
            KanbanBoard.id == board_id,
            KanbanBoard.factory_id == fid,
        )
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    cards_result = await db.execute(
        select(KanbanCard)
        .where(KanbanCard.board_id == board_id, KanbanCard.factory_id == fid)
        .order_by(KanbanCard.position)
    )
    cards = cards_result.scalars().all()

    return KanbanBoardDetailResponse(
        id=board.id,
        factory_id=board.factory_id,
        name=board.name,
        description=board.description,
        columns=board.columns,
        wip_limits=board.wip_limits,
        created_by_id=board.created_by_id,
        created_at=board.created_at,
        updated_at=board.updated_at,
        cards=cards,
    )


@router.patch("/boards/{board_id}", response_model=KanbanBoardResponse)
async def update_board(
    board_id: int,
    data: KanbanBoardUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanBoard).where(
            KanbanBoard.id == board_id,
            KanbanBoard.factory_id == fid,
        )
    )
    board = result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(board, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(board)
    return board


# ─── Card endpoints ───────────────────────────────────────────────────────────

@router.get("/boards/{board_id}/cards", response_model=list[KanbanCardResponse])
async def list_cards(
    board_id: int,
    column: str | None = Query(None),
    priority: str | None = Query(None),
    line_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    q = select(KanbanCard).where(
        KanbanCard.board_id == board_id,
        KanbanCard.factory_id == fid,
        KanbanCard.status == "active",
    )
    if column:
        q = q.where(KanbanCard.column_name == column)
    if priority:
        q = q.where(KanbanCard.priority == priority)
    if line_id:
        q = q.where(KanbanCard.assigned_line_id == line_id)

    q = q.order_by(KanbanCard.position).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/boards/{board_id}/cards", response_model=KanbanCardResponse)
async def create_card(
    board_id: int,
    data: KanbanCardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # Verify board exists and belongs to factory
    board_result = await db.execute(
        select(KanbanBoard).where(
            KanbanBoard.id == board_id,
            KanbanBoard.factory_id == fid,
        )
    )
    if not board_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Board not found")

    # IDOR check: validate production line
    if data.assigned_line_id is not None:
        line_result = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == data.assigned_line_id,
                ProductionLine.factory_id == fid,
            )
        )
        if not line_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")

    card = KanbanCard(
        board_id=board_id,
        factory_id=fid,
        created_by_id=user.id,
        **data.model_dump(),
    )
    db.add(card)
    await db.flush()
    await db.commit()
    await db.refresh(card)
    return card


@router.patch("/cards/{card_id}", response_model=KanbanCardResponse)
async def update_card(
    card_id: int,
    data: KanbanCardUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanCard).where(
            KanbanCard.id == card_id,
            KanbanCard.factory_id == fid,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    update_data = data.model_dump(exclude_unset=True)

    # IDOR check on line
    if "assigned_line_id" in update_data and update_data["assigned_line_id"] is not None:
        line_result = await db.execute(
            select(ProductionLine).where(
                ProductionLine.id == update_data["assigned_line_id"],
                ProductionLine.factory_id == fid,
            )
        )
        if not line_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Production line not in your factory")

    for field, value in update_data.items():
        setattr(card, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(card)
    return card


@router.patch("/cards/{card_id}/move", response_model=KanbanCardResponse)
async def move_card(
    card_id: int,
    data: KanbanCardMove,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanCard).where(
            KanbanCard.id == card_id,
            KanbanCard.factory_id == fid,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    # Get the board to know columns
    board_result = await db.execute(
        select(KanbanBoard).where(KanbanBoard.id == card.board_id)
    )
    board = board_result.scalar_one_or_none()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Validate target column
    if data.column_name not in board.columns:
        raise HTTPException(status_code=400, detail=f"Invalid column: {data.column_name}")

    # Check WIP limits
    column_counts = await KanbanService.get_column_counts(db, board.id)
    # If card is moving to a different column, check limit
    if data.column_name != card.column_name:
        limit_status = KanbanService.check_wip_limit(
            board.wip_limits, column_counts, data.column_name
        )
        if limit_status["status"] == "exceeded":
            raise HTTPException(
                status_code=409,
                detail=f"WIP limit exceeded for column '{data.column_name}': {limit_status['current']}/{limit_status['limit']}"
            )

    # Update column and position
    card.column_name = data.column_name
    card.position = data.position

    # Compute lead/cycle time
    first_col = board.columns[0] if board.columns else "backlog"
    last_col = board.columns[-1] if board.columns else "shipped"
    KanbanService.compute_lead_time(card, first_col, last_col, data.column_name)

    await db.flush()
    await db.commit()
    await db.refresh(card)
    return card


@router.delete("/cards/{card_id}")
async def delete_card(
    card_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    result = await db.execute(
        select(KanbanCard).where(
            KanbanCard.id == card_id,
            KanbanCard.factory_id == fid,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    await db.delete(card)
    await db.commit()
    return {"status": "deleted"}


# ─── Metrics endpoint ────────────────────────────────────────────────────────

@router.get("/boards/{board_id}/metrics", response_model=KanbanMetricsResponse)
async def board_metrics(
    board_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)

    # Verify board
    board_result = await db.execute(
        select(KanbanBoard).where(
            KanbanBoard.id == board_id,
            KanbanBoard.factory_id == fid,
        )
    )
    if not board_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Board not found")

    metrics = await KanbanService.compute_metrics(db, board_id, fid)
    return KanbanMetricsResponse(**metrics)
