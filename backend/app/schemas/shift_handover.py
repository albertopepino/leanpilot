from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class ShiftHandoverCreate(BaseModel):
    production_line_id: int
    outgoing_shift_id: Optional[int] = None
    incoming_shift_id: Optional[int] = None
    date: date
    safety_issues: Optional[str] = None
    quality_issues: Optional[str] = None
    equipment_issues: Optional[str] = None
    material_issues: Optional[str] = None
    pending_actions: list = []
    notes: Optional[str] = None


class ShiftHandoverUpdate(BaseModel):
    safety_issues: Optional[str] = None
    quality_issues: Optional[str] = None
    equipment_issues: Optional[str] = None
    material_issues: Optional[str] = None
    pending_actions: Optional[list] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ShiftHandoverResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: int
    outgoing_shift_id: Optional[int]
    incoming_shift_id: Optional[int]
    created_by_id: int
    acknowledged_by_id: Optional[int]
    date: date
    status: str
    total_pieces: Optional[int]
    good_pieces: Optional[int]
    scrap_pieces: Optional[int]
    oee_pct: Optional[float]
    downtime_min: Optional[float]
    safety_issues: Optional[str]
    quality_issues: Optional[str]
    equipment_issues: Optional[str]
    material_issues: Optional[str]
    pending_actions: list
    notes: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
