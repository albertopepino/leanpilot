from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class SafetyIncidentCreate(BaseModel):
    production_line_id: Optional[int] = None
    incident_type: str
    severity: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    date: date
    reported_by: Optional[str] = None
    status: str = "open"
    corrective_action: Optional[str] = None


class SafetyIncidentUpdate(BaseModel):
    production_line_id: Optional[int] = None
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    date: Optional[date] = None
    reported_by: Optional[str] = None
    status: Optional[str] = None
    corrective_action: Optional[str] = None


class SafetyIncidentResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: Optional[int]
    created_by_id: int
    incident_type: str
    severity: str
    title: str
    description: Optional[str]
    location: Optional[str]
    date: date
    reported_by: Optional[str]
    status: str
    corrective_action: Optional[str]
    andon_event_id: Optional[int] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Safety Documents ────────────────────────────────────────────────────────


class SafetyDocumentResponse(BaseModel):
    id: int
    factory_id: int
    uploaded_by_id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    filename: str
    file_size: int
    mime_type: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
