from typing import Literal
from pydantic import BaseModel, Field
from datetime import datetime


# ─── Constrained types ───────────────────────────────────────────────────────

Priority = Literal["low", "medium", "high", "urgent"]
CardStatus = Literal["active", "archived"]


# ─── Board schemas ────────────────────────────────────────────────────────────

class KanbanBoardCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: str | None = Field(None, max_length=500)
    columns: list[str] = Field(
        default=["backlog", "in_queue", "in_progress", "done", "shipped"]
    )
    wip_limits: dict[str, int] = Field(default={
        "backlog": 0, "in_queue": 5, "in_progress": 3, "done": 10, "shipped": 0,
    })


class KanbanBoardUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=500)
    columns: list[str] | None = None
    wip_limits: dict[str, int] | None = None


class KanbanBoardResponse(BaseModel):
    id: int
    factory_id: int
    name: str
    description: str | None = None
    columns: list[str]
    wip_limits: dict[str, int]
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Card schemas ─────────────────────────────────────────────────────────────

class KanbanCardCreate(BaseModel):
    column_name: str = "backlog"
    position: int = 0
    title: str = Field(..., max_length=300)
    description: str | None = Field(None, max_length=2000)
    product_name: str | None = Field(None, max_length=200)
    order_number: str | None = Field(None, max_length=100)
    quantity: int | None = Field(0, ge=0)
    priority: Priority = "medium"
    assigned_line_id: int | None = None
    due_date: datetime | None = None
    assigned_to_id: int | None = None


class KanbanCardUpdate(BaseModel):
    column_name: str | None = None
    position: int | None = None
    title: str | None = Field(None, max_length=300)
    description: str | None = Field(None, max_length=2000)
    product_name: str | None = Field(None, max_length=200)
    order_number: str | None = Field(None, max_length=100)
    quantity: int | None = Field(None, ge=0)
    priority: Priority | None = None
    assigned_line_id: int | None = None
    due_date: datetime | None = None
    assigned_to_id: int | None = None
    status: CardStatus | None = None


class KanbanCardMove(BaseModel):
    column_name: str
    position: int = 0


class KanbanCardResponse(BaseModel):
    id: int
    board_id: int
    factory_id: int
    column_name: str
    position: int
    title: str
    description: str | None = None
    product_name: str | None = None
    order_number: str | None = None
    quantity: int | None = 0
    priority: str
    assigned_line_id: int | None = None
    due_date: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    lead_time_hours: float | None = None
    cycle_time_hours: float | None = None
    status: str
    created_by_id: int
    assigned_to_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Board with cards response ───────────────────────────────────────────────

class KanbanBoardDetailResponse(KanbanBoardResponse):
    cards: list[KanbanCardResponse] = []


# ─── Metrics response ────────────────────────────────────────────────────────

class KanbanMetricsResponse(BaseModel):
    total_wip: int
    wip_by_column: dict[str, int]
    avg_lead_time_hours: float | None = None
    avg_cycle_time_hours: float | None = None
    throughput_per_day: float | None = None
    on_time_delivery_pct: float | None = None
    total_completed: int = 0
    total_overdue: int = 0
