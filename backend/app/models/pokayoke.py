from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime, Date
from app.models.base import Base, TimestampMixin


class PokaYokeDevice(TimestampMixin, Base):
    """Poka-Yoke error-proofing device registry."""
    __tablename__ = "pokayoke_devices"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    name = Column(String(200), nullable=False)
    device_type = Column(String(30), nullable=False)  # contact, fixed_value, motion_step, informational, warning, control
    location = Column(String(200), nullable=True)
    process_step = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    installation_date = Column(Date, nullable=True)
    verification_frequency = Column(String(20), nullable=False, default="weekly")  # daily, weekly, monthly
    last_verified_at = Column(DateTime(timezone=True), nullable=True)
    effectiveness_rate = Column(Float, nullable=True, default=100.0)
    status = Column(String(20), nullable=False, default="active")  # active, inactive, needs_repair
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class PokaYokeVerification(TimestampMixin, Base):
    """Verification log entry for a poka-yoke device."""
    __tablename__ = "pokayoke_verifications"

    device_id = Column(Integer, ForeignKey("pokayoke_devices.id"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    result = Column(String(10), nullable=False)  # PASS, FAIL
    notes = Column(Text, nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=False)
