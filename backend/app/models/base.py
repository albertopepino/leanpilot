from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase


def _utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
    )
