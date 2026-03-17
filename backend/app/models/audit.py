"""
Audit Log Model — GDPR Art. 5(2) accountability, Art. 30 records of processing.
Immutable log of all data access and modifications for compliance.
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from datetime import datetime, timezone

from app.models.base import Base


class AuditLog(Base):
    """Immutable audit trail for GDPR accountability."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    # Who
    user_id = Column(Integer, nullable=True, index=True)  # NULL for system actions
    user_email = Column(String, nullable=True)  # Denormalized for post-deletion queries
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6

    # What
    action = Column(String(50), nullable=False, index=True)  # CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, etc.
    resource_type = Column(String(50), nullable=False)  # user, production_record, kaizen, etc.
    resource_id = Column(String(50), nullable=True)  # ID of affected resource

    # Context
    factory_id = Column(Integer, nullable=True, index=True)
    detail = Column(Text, nullable=True)  # Human-readable description (PII-masked)
    metadata_ = Column("metadata", JSON, nullable=True)  # Additional structured data

    # Compliance
    legal_basis = Column(String(50), nullable=True)  # GDPR article reference
    data_categories = Column(String(200), nullable=True)  # e.g. "personal,production,ai"


class ConsentRecord(Base):
    """Immutable record of consent given/withdrawn — GDPR Art. 7(1)."""
    __tablename__ = "consent_records"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    user_id = Column(Integer, nullable=False, index=True)
    consent_type = Column(String(50), nullable=False)  # privacy_policy, terms, ai_processing, marketing
    action = Column(String(20), nullable=False)  # granted, withdrawn
    version = Column(String(20), nullable=True)  # Policy version
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
