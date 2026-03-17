from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON, Date
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class HandoverStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"


class ShiftHandover(TimestampMixin, Base):
    """Shift handover record — auto-generated at shift end or manual."""
    __tablename__ = "shift_handovers"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    outgoing_shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    incoming_shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    acknowledged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    date = Column(Date, nullable=False)
    status = Column(String(20), default="draft")

    # Production summary (auto-populated)
    total_pieces = Column(Integer, nullable=True)
    good_pieces = Column(Integer, nullable=True)
    scrap_pieces = Column(Integer, nullable=True)
    oee_pct = Column(Float, nullable=True)
    downtime_min = Column(Float, nullable=True)

    # Manual fields
    safety_issues = Column(Text, nullable=True)
    quality_issues = Column(Text, nullable=True)
    equipment_issues = Column(Text, nullable=True)
    material_issues = Column(Text, nullable=True)
    pending_actions = Column(JSON, default=list)  # [{description, priority, owner}]
    notes = Column(Text, nullable=True)

    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
