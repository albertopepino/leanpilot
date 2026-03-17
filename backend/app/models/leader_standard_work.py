from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Boolean, JSON, Date
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class LSWFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class LeaderStandardWork(TimestampMixin, Base):
    """Leader Standard Work template per role."""
    __tablename__ = "leader_standard_work"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    role = Column(String(50), nullable=False)  # operator, supervisor, manager
    frequency = Column(String(20), default="daily")
    estimated_time_min = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    tasks = Column(JSON, default=list)  # [{order, description, time_min, category}]


class LSWCompletion(TimestampMixin, Base):
    """Daily LSW completion record."""
    __tablename__ = "lsw_completions"

    lsw_id = Column(Integer, ForeignKey("leader_standard_work.id"), nullable=False)
    completed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    date = Column(Date, nullable=False)
    completed_tasks = Column(JSON, default=list)  # [{task_index, completed, notes, time_min}]
    completion_pct = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
