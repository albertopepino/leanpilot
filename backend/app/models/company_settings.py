from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint, JSON
from app.models.base import Base, TimestampMixin


class CompanySettings(TimestampMixin, Base):
    __tablename__ = "company_settings"
    __table_args__ = (
        UniqueConstraint("factory_id", name="uq_company_settings_factory"),
    )

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    logo_filename = Column(String, nullable=True)
    company_display_name = Column(String, nullable=True)

    # 5S/6S configurable label
    audit_label = Column(String, nullable=True, default="6S")

    # Scheduled email reports
    email_reports_enabled = Column(Boolean, nullable=True, default=False)
    daily_oee_recipients = Column(JSON, nullable=True)
    weekly_kaizen_recipients = Column(JSON, nullable=True)
    report_timezone = Column(String, nullable=True, default="UTC")
