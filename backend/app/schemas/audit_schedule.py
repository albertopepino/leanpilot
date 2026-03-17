from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class AuditScheduleCreate(BaseModel):
    audit_type: str
    title: str
    area: Optional[str] = None
    production_line_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    frequency: str = "monthly"
    next_due_date: date
    escalation_days: int = 2
    notes: Optional[str] = None


class AuditScheduleUpdate(BaseModel):
    title: Optional[str] = None
    area: Optional[str] = None
    production_line_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    frequency: Optional[str] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None
    escalation_days: Optional[int] = None
    notes: Optional[str] = None


class AuditScheduleResponse(BaseModel):
    id: int
    factory_id: int
    created_by_id: int
    audit_type: str
    title: str
    area: Optional[str]
    production_line_id: Optional[int]
    assigned_to_id: Optional[int]
    frequency: str
    next_due_date: date
    last_completed_date: Optional[date]
    is_active: bool
    escalation_days: int
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
