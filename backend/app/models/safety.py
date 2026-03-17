from sqlalchemy import Column, Integer, String, ForeignKey, Date, Text
from app.models.base import Base, TimestampMixin


class SafetyIncident(TimestampMixin, Base):
    """Safety incident tracking — injuries, near misses, first aid, etc."""
    __tablename__ = "safety_incidents"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    incident_type = Column(String(30), nullable=False)  # injury, near_miss, first_aid, property_damage, environmental
    severity = Column(String(20), nullable=False)  # minor, moderate, serious, critical
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    date = Column(Date, nullable=False, index=True)
    reported_by = Column(String, nullable=True)
    status = Column(String(20), nullable=False, server_default="open")  # open, investigating, resolved, closed
    corrective_action = Column(Text, nullable=True)
