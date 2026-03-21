from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


class ERPIntegration(TimestampMixin, Base):
    __tablename__ = "erp_integrations"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False, index=True)
    erp_type = Column(String, nullable=False)  # "navision", "sap", "oracle"
    display_name = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=False)

    # Connection config
    host = Column(String, nullable=True)
    port = Column(Integer, nullable=True)
    database_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    password_encrypted = Column(String, nullable=True)
    api_key_encrypted = Column(String, nullable=True)

    # SAP-specific
    sap_client = Column(String, nullable=True)
    sap_system_number = Column(String, nullable=True)

    # Oracle-specific
    oracle_service_name = Column(String, nullable=True)

    # Sync settings
    sync_products = Column(Boolean, nullable=True, default=True)
    sync_production_orders = Column(Boolean, nullable=True, default=True)
    sync_inventory = Column(Boolean, nullable=True, default=False)
    sync_interval_minutes = Column(Integer, nullable=True, default=60)

    # Sync status
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String, nullable=True)  # "success", "error", "running"
    last_sync_message = Column(String, nullable=True)
