from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NotificationCreate(BaseModel):
    user_id: int
    notification_type: str
    priority: str = "medium"
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None


class NotificationResponse(BaseModel):
    id: int
    factory_id: int
    user_id: int
    notification_type: str
    priority: str
    title: str
    message: Optional[str]
    link: Optional[str]
    is_read: bool
    read_at: Optional[datetime]
    source_type: Optional[str]
    source_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCountResponse(BaseModel):
    unread: int
    total: int
