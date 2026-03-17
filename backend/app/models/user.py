from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PLANT_MANAGER = "plant_manager"
    LINE_SUPERVISOR = "line_supervisor"
    OPERATOR = "operator"
    VIEWER = "viewer"


class SubscriptionTier(str, enum.Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.VIEWER)
    is_active = Column(Boolean, default=True, server_default=text("true"))
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True)
    language = Column(String(5), default="en", server_default=text("'en'"))

    # GDPR Consent fields (Art. 6, 7)
    privacy_policy_accepted_at = Column(DateTime(timezone=True), nullable=True)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    consent_version = Column(String(20), nullable=True)  # e.g. "1.0", "1.1"
    ai_consent = Column(Boolean, default=False, server_default=text("false"))
    marketing_consent = Column(Boolean, default=False, server_default=text("false"))

    # Soft delete (Art. 17 — Right to erasure)
    is_deleted = Column(Boolean, default=False, server_default=text("false"))
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)

    # 2FA / TOTP
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False, server_default=text("false"))

    # Security — account lockout & session tracking
    failed_login_attempts = Column(Integer, default=0, server_default=text("0"))
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)  # IPv4 or IPv6
    last_user_agent = Column(String(512), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)

    # Password reset
    reset_token = Column(String(128), nullable=True, index=True)
    reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    factory = relationship("Factory", back_populates="users")
