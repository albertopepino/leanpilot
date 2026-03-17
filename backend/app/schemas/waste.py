from typing import Literal
from pydantic import BaseModel, Field
from datetime import date, datetime


# ─── Constrained types ───────────────────────────────────────────────────────

WasteType = Literal[
    "transportation", "inventory", "motion", "waiting",
    "overproduction", "overprocessing", "defects", "skills",
]

Severity = Literal["low", "medium", "high", "critical"]

WasteStatus = Literal["open", "investigating", "action_taken", "resolved"]


# ─── Create / Update ─────────────────────────────────────────────────────────

class WasteEventCreate(BaseModel):
    production_line_id: int | None = None
    waste_type: WasteType
    category: str | None = Field(None, max_length=100)
    description: str = Field(..., max_length=500)
    estimated_cost: float = Field(0, ge=0)
    estimated_time_minutes: int = Field(0, ge=0)
    severity: Severity = "medium"
    status: WasteStatus = "open"
    root_cause: str | None = Field(None, max_length=500)
    countermeasure: str | None = Field(None, max_length=500)
    linked_kaizen_id: int | None = None
    date_occurred: date


class WasteEventUpdate(BaseModel):
    production_line_id: int | None = None
    waste_type: WasteType | None = None
    category: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=500)
    estimated_cost: float | None = Field(None, ge=0)
    estimated_time_minutes: int | None = Field(None, ge=0)
    severity: Severity | None = None
    status: WasteStatus | None = None
    root_cause: str | None = Field(None, max_length=500)
    countermeasure: str | None = Field(None, max_length=500)
    linked_kaizen_id: int | None = None
    date_occurred: date | None = None


# ─── Response ────────────────────────────────────────────────────────────────

class WasteEventResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: int | None = None
    reported_by: int
    waste_type: str
    category: str | None = None
    description: str
    estimated_cost: float
    estimated_time_minutes: int
    severity: str
    status: str
    root_cause: str | None = None
    countermeasure: str | None = None
    linked_kaizen_id: int | None = None
    date_occurred: date
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WasteSummaryByType(BaseModel):
    waste_type: str
    count: int
    total_cost: float
    total_time_minutes: int


class WasteSummaryByLine(BaseModel):
    production_line_id: int | None = None
    count: int
    total_cost: float


class WasteSummaryResponse(BaseModel):
    total_events: int
    total_cost: float
    total_time_minutes: int
    by_type: list[WasteSummaryByType]
    by_line: list[WasteSummaryByLine]
    by_severity: dict[str, int]
    by_status: dict[str, int]
