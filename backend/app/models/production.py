from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class DowntimeCategory(str, enum.Enum):
    PLANNED = "planned"
    UNPLANNED = "unplanned"
    CHANGEOVER = "changeover"
    MAINTENANCE = "maintenance"
    MATERIAL = "material"
    QUALITY = "quality"
    OTHER = "other"


class ProductionRecord(TimestampMixin, Base):
    __tablename__ = "production_records"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    planned_production_time_min = Column(Float, nullable=False)
    actual_run_time_min = Column(Float, nullable=False)
    total_pieces = Column(Integer, nullable=False)
    good_pieces = Column(Integer, nullable=False)
    ideal_cycle_time_sec = Column(Float, nullable=False)

    # Phase 1: Manufacturing tree linkage (nullable for backward compat)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    notes = Column(Text)


class DowntimeEvent(TimestampMixin, Base):
    __tablename__ = "downtime_events"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    production_record_id = Column(Integer, ForeignKey("production_records.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Float)
    category = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    machine = Column(String)
    notes = Column(Text)


class ScrapRecord(TimestampMixin, Base):
    __tablename__ = "scrap_records"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    production_record_id = Column(Integer, ForeignKey("production_records.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    quantity = Column(Integer, nullable=False)
    defect_type = Column(String, nullable=False)  # legacy free-text, kept for backward compat
    defect_catalog_id = Column(Integer, ForeignKey("defect_catalog.id"), nullable=True)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    defect_description = Column(Text)
    cost_estimate = Column(Float)
    root_cause = Column(String)
