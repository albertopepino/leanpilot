from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Text, Numeric
from app.models.base import Base, TimestampMixin


class WasteEvent(TimestampMixin, Base):
    """Tracks the 8 wastes (TIMWOODS/DOWNTIME) identified on the shop floor."""
    __tablename__ = "waste_events"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # TIMWOODS: transportation, inventory, motion, waiting,
    #           overproduction, overprocessing, defects, skills
    waste_type = Column(String(50), nullable=False)
    category = Column(String(100), nullable=True)  # sub-category
    description = Column(Text, nullable=False)

    estimated_cost = Column(Numeric(12, 2), default=0)
    estimated_time_minutes = Column(Integer, default=0)
    severity = Column(String(20), default="medium")  # low, medium, high, critical
    status = Column(String(20), default="open")  # open, investigating, action_taken, resolved

    root_cause = Column(Text, nullable=True)
    countermeasure = Column(Text, nullable=True)

    linked_kaizen_id = Column(Integer, ForeignKey("kaizen_items.id"), nullable=True)
    date_occurred = Column(Date, nullable=False, index=True)
