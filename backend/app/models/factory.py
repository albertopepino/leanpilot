from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import relationship
import enum

from app.models.base import Base, TimestampMixin
from app.models.user import SubscriptionTier


class Factory(TimestampMixin, Base):
    __tablename__ = "factories"

    name = Column(String, nullable=False)
    location = Column(String)
    country = Column(String(2))  # ISO country code
    sector = Column(String)  # e.g. "cosmetics", "automotive", "food"
    employee_count = Column(Integer)
    subscription_tier = Column(SAEnum(SubscriptionTier), default=SubscriptionTier.STARTER)
    ai_enabled = Column(Boolean, default=False)
    timezone = Column(String(50), default="UTC", nullable=True)
    custom_permissions = Column(JSON, nullable=True)  # overrides for TAB_PERMISSIONS

    # Multi-site fields
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_code = Column(String(20), nullable=True)  # short code like "MIL", "BGD"

    users = relationship("User", back_populates="factory")
    production_lines = relationship("ProductionLine", back_populates="factory")
    organization = relationship("Organization", back_populates="sites")


class ProductionLine(TimestampMixin, Base):
    __tablename__ = "production_lines"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "ILPRA", "Line 3"
    product_type = Column(String)  # e.g. "soap packaging", "assembly"
    target_oee = Column(Float, default=85.0)
    target_cycle_time_seconds = Column(Float)
    is_active = Column(Boolean, default=True)

    factory = relationship("Factory", back_populates="production_lines")
    shifts = relationship("Shift", back_populates="production_line")


class Shift(TimestampMixin, Base):
    __tablename__ = "shifts"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Morning", "Afternoon", "Night"
    start_hour = Column(Integer, nullable=False)  # 0-23
    end_hour = Column(Integer, nullable=False)
    planned_minutes = Column(Integer, default=480)

    production_line = relationship("ProductionLine", back_populates="shifts")
