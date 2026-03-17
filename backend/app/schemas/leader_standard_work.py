from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class LSWCreate(BaseModel):
    title: str
    role: str
    frequency: str = "daily"
    estimated_time_min: Optional[int] = None
    tasks: list = []


class LSWUpdate(BaseModel):
    title: Optional[str] = None
    role: Optional[str] = None
    frequency: Optional[str] = None
    estimated_time_min: Optional[int] = None
    is_active: Optional[bool] = None
    tasks: Optional[list] = None


class LSWResponse(BaseModel):
    id: int
    factory_id: int
    created_by_id: int
    title: str
    role: str
    frequency: str
    estimated_time_min: Optional[int]
    is_active: bool
    tasks: list
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LSWCompletionCreate(BaseModel):
    lsw_id: int
    date: date
    completed_tasks: list = []
    completion_pct: Optional[float] = None
    notes: Optional[str] = None


class LSWCompletionResponse(BaseModel):
    id: int
    lsw_id: int
    completed_by_id: int
    date: date
    completed_tasks: list
    completion_pct: Optional[float]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
