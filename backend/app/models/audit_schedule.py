from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean, Date
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class AuditType(str, enum.Enum):
    SIX_S = "six_s"
    TPM = "tpm"
    QC = "qc"
    GEMBA = "gemba"
    SAFETY = "safety"


class AuditFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class AuditSchedule(TimestampMixin, Base):
    """Scheduled audits for 6S/TPM/QC."""
    __tablename__ = "audit_schedules"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    audit_type = Column(String(20), nullable=False)
    title = Column(String, nullable=False)
    area = Column(String, nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    frequency = Column(String(20), nullable=False, default="monthly")
    next_due_date = Column(Date, nullable=False)
    last_completed_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    escalation_days = Column(Integer, default=2)  # escalate after N days overdue
    notes = Column(Text, nullable=True)
