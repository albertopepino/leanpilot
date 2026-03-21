from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.ext.mutable import MutableList, MutableDict
from app.models.base import TimestampMixin, Base


class HorizontalDeployment(TimestampMixin, Base):
    __tablename__ = "horizontal_deployments"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    source_type = Column(String, nullable=False)  # five_why, kaizen, ncr
    source_id = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    target_lines = Column(MutableList.as_mutable(JSON), default=list)
    completed_lines = Column(MutableList.as_mutable(JSON), default=list)  # [{line_id, completed_at, notes}]
    deployed_by_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="open")
