from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.models.base import Base, TimestampMixin


class CompanySettings(TimestampMixin, Base):
    __tablename__ = "company_settings"
    __table_args__ = (
        UniqueConstraint("factory_id", name="uq_company_settings_factory"),
    )

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    logo_filename = Column(String, nullable=True)
    company_display_name = Column(String, nullable=True)
