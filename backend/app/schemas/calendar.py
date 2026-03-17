from pydantic import BaseModel
from datetime import datetime, date
from enum import Enum


class CalendarEventSource(str, Enum):
    capa = "capa"
    kaizen = "kaizen"
    tpm_maintenance = "tpm_maintenance"
    tpm_equipment = "tpm_equipment"
    six_s = "six_s"
    gemba = "gemba"
    production_order_start = "production_order_start"
    production_order_end = "production_order_end"
    cilt = "cilt"


class CalendarEvent(BaseModel):
    id: int
    source: CalendarEventSource
    title: str
    date: datetime
    end_date: datetime | None = None
    status: str | None = None
    priority: str | None = None
    production_line_id: int | None = None
    production_line_name: str | None = None
    source_id: int
    view_key: str  # frontend View string to navigate to


class CalendarEventsResponse(BaseModel):
    events: list[CalendarEvent]
    date_from: date
    date_to: date
