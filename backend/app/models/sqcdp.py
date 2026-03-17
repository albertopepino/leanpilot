from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON, Date
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class SQCDPCategory(str, enum.Enum):
    SAFETY = "safety"
    QUALITY = "quality"
    COST = "cost"
    DELIVERY = "delivery"
    PEOPLE = "people"


class SQCDPStatus(str, enum.Enum):
    GREEN = "green"
    AMBER = "amber"
    RED = "red"


class SQCDPEntry(TimestampMixin, Base):
    """Daily SQCDP board entry per production line."""
    __tablename__ = "sqcdp_entries"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    date = Column(Date, nullable=False, index=True)
    category = Column(String(20), nullable=False)  # safety, quality, cost, delivery, people
    status = Column(String(10), nullable=False, default="green")  # green, amber, red
    metric_value = Column(Float, nullable=True)
    target_value = Column(Float, nullable=True)
    comment = Column(Text, nullable=True)
    action_required = Column(Boolean, default=False)
    action_owner = Column(String, nullable=True)
    action_due_date = Column(Date, nullable=True)
    tier_level = Column(Integer, default=1)  # 1=team, 2=dept, 3=plant


class SQCDPMeeting(TimestampMixin, Base):
    """Tier meeting record linked to SQCDP board."""
    __tablename__ = "sqcdp_meetings"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    led_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    date = Column(Date, nullable=False)
    tier_level = Column(Integer, nullable=False, default=1)
    duration_min = Column(Integer, nullable=True)
    attendee_count = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    action_items = Column(JSON, default=list)  # [{description, owner, due_date, status}]
    escalated_items = Column(JSON, default=list)  # items escalated to next tier
