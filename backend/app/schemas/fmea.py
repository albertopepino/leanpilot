"""Pydantic schemas for FMEA (Failure Mode and Effects Analysis)."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---------------------------------------------------------------------------
# Item schemas
# ---------------------------------------------------------------------------

class FMEAItemCreate(BaseModel):
    process_step: Optional[str] = None
    failure_mode: str
    failure_effect: Optional[str] = None
    failure_cause: Optional[str] = None
    severity: int = 1
    occurrence: int = 1
    detection: int = 1
    current_controls: Optional[str] = None
    recommended_action: Optional[str] = None
    responsible: Optional[str] = None
    target_date: Optional[str] = None


class FMEAItemUpdate(BaseModel):
    process_step: Optional[str] = None
    failure_mode: Optional[str] = None
    failure_effect: Optional[str] = None
    failure_cause: Optional[str] = None
    severity: Optional[int] = None
    occurrence: Optional[int] = None
    detection: Optional[int] = None
    current_controls: Optional[str] = None
    recommended_action: Optional[str] = None
    responsible: Optional[str] = None
    target_date: Optional[str] = None
    action_taken: Optional[str] = None
    new_severity: Optional[int] = None
    new_occurrence: Optional[int] = None
    new_detection: Optional[int] = None
    status: Optional[str] = None


class FMEAItemResponse(BaseModel):
    id: int
    analysis_id: int
    process_step: Optional[str] = None
    failure_mode: str
    failure_effect: Optional[str] = None
    failure_cause: Optional[str] = None
    severity: int
    occurrence: int
    detection: int
    rpn: int
    current_controls: Optional[str] = None
    recommended_action: Optional[str] = None
    responsible: Optional[str] = None
    target_date: Optional[str] = None
    action_taken: Optional[str] = None
    new_severity: Optional[int] = None
    new_occurrence: Optional[int] = None
    new_detection: Optional[int] = None
    new_rpn: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Analysis schemas
# ---------------------------------------------------------------------------

class FMEACreate(BaseModel):
    title: str
    fmea_type: str = "process"
    product_name: Optional[str] = None
    process_name: Optional[str] = None
    team_members: Optional[str] = None
    items: List[FMEAItemCreate] = []


class FMEAUpdate(BaseModel):
    title: Optional[str] = None
    fmea_type: Optional[str] = None
    product_name: Optional[str] = None
    process_name: Optional[str] = None
    team_members: Optional[str] = None
    status: Optional[str] = None


class FMEAResponse(BaseModel):
    id: int
    factory_id: int
    created_by_id: int
    title: str
    fmea_type: str
    product_name: Optional[str] = None
    process_name: Optional[str] = None
    team_members: Optional[str] = None
    status: str
    items: List[FMEAItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
