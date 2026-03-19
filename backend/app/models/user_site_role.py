"""UserSiteRole model — per-site role assignments for multi-site RBAC."""

from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserSiteRole(Base):
    __tablename__ = "user_site_roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    site_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("factories.id", ondelete="CASCADE"), index=True, nullable=True
    )  # NULL = org-level (corporate) role
    organization_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(50))  # one of ROLES keys
    scope_line_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)  # optional: restrict to specific lines
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="site_roles")
    site = relationship("Factory")
    organization = relationship("Organization")

    __table_args__ = (
        UniqueConstraint("user_id", "site_id", "role", name="uq_user_site_role"),
    )
