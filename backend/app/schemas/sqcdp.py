from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class SQCDPEntryCreate(BaseModel):
    production_line_id: Optional[int] = None
    date: date
    category: str
    status: str = "green"
    metric_value: Optional[float] = None
    target_value: Optional[float] = None
    comment: Optional[str] = None
    action_required: bool = False
    action_owner: Optional[str] = None
    action_due_date: Optional[date] = None
    tier_level: int = 1


class SQCDPEntryUpdate(BaseModel):
    status: Optional[str] = None
    metric_value: Optional[float] = None
    target_value: Optional[float] = None
    comment: Optional[str] = None
    action_required: Optional[bool] = None
    action_owner: Optional[str] = None
    action_due_date: Optional[date] = None


class SQCDPEntryResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: Optional[int]
    created_by_id: int
    date: date
    category: str
    status: str
    metric_value: Optional[float]
    target_value: Optional[float]
    comment: Optional[str]
    action_required: bool
    action_owner: Optional[str]
    action_due_date: Optional[date]
    tier_level: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SQCDPMeetingCreate(BaseModel):
    production_line_id: Optional[int] = None
    date: date
    tier_level: int = 1
    duration_min: Optional[int] = None
    attendee_count: Optional[int] = None
    notes: Optional[str] = None
    action_items: list = []
    escalated_items: list = []


class SQCDPMeetingResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: Optional[int]
    led_by_id: int
    date: date
    tier_level: int
    duration_min: Optional[int]
    attendee_count: Optional[int]
    notes: Optional[str]
    action_items: list
    escalated_items: list
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SQCDPBoardResponse(BaseModel):
    """Aggregated SQCDP board view for a date."""
    date: date
    entries: list[SQCDPEntryResponse]
    safety: Optional[SQCDPEntryResponse] = None
    quality: Optional[SQCDPEntryResponse] = None
    cost: Optional[SQCDPEntryResponse] = None
    delivery: Optional[SQCDPEntryResponse] = None
    people: Optional[SQCDPEntryResponse] = None
