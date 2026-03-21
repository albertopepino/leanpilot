from sqlalchemy import Column, Integer, String, ForeignKey, Date, Text, Boolean
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
    andon_event_id = Column(Integer, ForeignKey("andon_events.id"), nullable=True)
    photo_url = Column(String, nullable=True)


class SafetyDocument(TimestampMixin, Base):
    """
    Safety document repository (SOP, MSDS, Risk Assessments, etc.).
    Stores file metadata; actual files stored on disk under uploads/safety/.
    """
    __tablename__ = "safety_documents"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)  # SOP, MSDS, Risk Assessment, Emergency Plan, Training Material, Inspection Checklist, Other
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # relative path on disk
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
