from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class NotificationType(str, enum.Enum):
    QC_FAIL = "qc_fail"
    ANDON_TRIGGERED = "andon_triggered"
    NCR_CREATED = "ncr_created"
    CAPA_OVERDUE = "capa_overdue"
    KAIZEN_ASSIGNED = "kaizen_assigned"
    TPM_DUE = "tpm_due"
    SHIFT_HANDOVER = "shift_handover"
    ESCALATION = "escalation"
    AUDIT_DUE = "audit_due"
    OEE_DROP = "oee_drop"
    GENERAL = "general"


class NotificationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Notification(TimestampMixin, Base):
    """User notification — real-time via SSE, email digest."""
    __tablename__ = "notifications"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    notification_type = Column(String(50), nullable=False)
    priority = Column(String(20), default="medium")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    link = Column(String(500), nullable=True)  # frontend route to navigate to

    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    is_email_sent = Column(Boolean, default=False)

    # Source tracking
    source_type = Column(String(50), nullable=True)  # qc_record, andon_event, ncr, capa, etc.
    source_id = Column(Integer, nullable=True)
