from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint, Table
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin

# Association table
user_groups = Table(
    "user_groups", Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Group(TimestampMixin, Base):
    __tablename__ = "groups"
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, nullable=True)  # hex color for UI
    is_active = Column(Boolean, default=True)

    policies = relationship("GroupPolicy", back_populates="group", cascade="all, delete-orphan")
    members = relationship("User", secondary=user_groups, backref="groups")

    __table_args__ = (UniqueConstraint("factory_id", "name", name="uq_group_factory_name"),)


class GroupPolicy(TimestampMixin, Base):
    __tablename__ = "group_policies"
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    tab_id = Column(String, nullable=False)
    permission = Column(String, nullable=False)  # full, modify, view, hidden

    group = relationship("Group", back_populates="policies")

    __table_args__ = (UniqueConstraint("group_id", "tab_id", name="uq_group_tab"),)
