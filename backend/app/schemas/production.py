from pydantic import BaseModel, field_validator
from datetime import datetime, date as date_type


def _lower(v):
    """Normalize enum string values to lowercase (handles UPPERCASE from PostgreSQL)."""
    if isinstance(v, str):
        return v.lower()
    if hasattr(v, 'value'):
        return v.value
    return v


class ProductionRecordCreate(BaseModel):
    production_line_id: int
    shift_id: int | None = None
    production_order_id: int | None = None
    product_id: int | None = None
    date: datetime

    @field_validator("date", mode="before")
    @classmethod
    def parse_date_string(cls, v):
        if isinstance(v, str) and "T" not in v and " " not in v:
            return datetime.fromisoformat(v + "T00:00:00")
        return v
    planned_production_time_min: float
    actual_run_time_min: float
    total_pieces: int
    good_pieces: int
    ideal_cycle_time_sec: float
    notes: str | None = None


class ProductionRecordResponse(BaseModel):
    id: int
    production_line_id: int
    date: datetime
    planned_production_time_min: float
    actual_run_time_min: float
    total_pieces: int
    good_pieces: int
    ideal_cycle_time_sec: float
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class DowntimeEventCreate(BaseModel):
    production_line_id: int
    production_record_id: int | None = None
    start_time: datetime
    end_time: datetime | None = None
    duration_minutes: float | None = None
    category: str
    reason: str
    machine: str | None = None
    notes: str | None = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def parse_date_string(cls, v):
        if isinstance(v, str) and "T" not in v and " " not in v:
            return datetime.fromisoformat(v + "T00:00:00")
        return v


class ScrapRecordCreate(BaseModel):
    production_line_id: int
    production_record_id: int | None = None
    date: datetime

    @field_validator("date", mode="before")
    @classmethod
    def parse_date_string(cls, v):
        if isinstance(v, str) and "T" not in v and " " not in v:
            return datetime.fromisoformat(v + "T00:00:00")
        return v
    quantity: int
    defect_type: str
    defect_description: str | None = None
    cost_estimate: float | None = None
    root_cause: str | None = None
