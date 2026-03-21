"""FMEA -- Failure Mode and Effects Analysis (AIAG/VDA)."""
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class FMEAAnalysis(TimestampMixin, Base):
    __tablename__ = "fmea_analyses"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    fmea_type = Column(String(50), default="process")  # process | design | system
    product_name = Column(String(255), nullable=True)
    process_name = Column(String(255), nullable=True)
    team_members = Column(String(500), nullable=True)
    status = Column(String(50), default="draft")  # draft | in_progress | completed | approved

    items = relationship(
        "FMEAItem",
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="FMEAItem.id",
    )


class FMEAItem(TimestampMixin, Base):
    __tablename__ = "fmea_items"

    analysis_id = Column(Integer, ForeignKey("fmea_analyses.id", ondelete="CASCADE"), nullable=False)
    process_step = Column(String(255), nullable=True)
    failure_mode = Column(String(500), nullable=False)
    failure_effect = Column(Text, nullable=True)
    failure_cause = Column(Text, nullable=True)
    severity = Column(Integer, default=1)       # 1-10
    occurrence = Column(Integer, default=1)      # 1-10
    detection = Column(Integer, default=1)       # 1-10
    rpn = Column(Integer, default=1)             # S x O x D
    current_controls = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=True)
    responsible = Column(String(255), nullable=True)
    target_date = Column(String(50), nullable=True)
    action_taken = Column(Text, nullable=True)
    new_severity = Column(Integer, nullable=True)
    new_occurrence = Column(Integer, nullable=True)
    new_detection = Column(Integer, nullable=True)
    new_rpn = Column(Integer, nullable=True)
    status = Column(String(50), default="open")  # open | in_progress | closed

    analysis = relationship("FMEAAnalysis", back_populates="items")
