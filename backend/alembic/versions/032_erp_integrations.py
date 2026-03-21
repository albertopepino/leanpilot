"""Add ERP integrations table

Revision ID: 032
Revises: 031
"""
from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "erp_integrations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("erp_type", sa.String(), nullable=False),  # navision, sap, oracle
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        # Connection config (encrypted at rest via app-level encryption)
        sa.Column("host", sa.String(), nullable=True),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("database_name", sa.String(), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("password_encrypted", sa.String(), nullable=True),
        sa.Column("api_key_encrypted", sa.String(), nullable=True),
        # SAP-specific
        sa.Column("sap_client", sa.String(), nullable=True),
        sa.Column("sap_system_number", sa.String(), nullable=True),
        # Oracle-specific
        sa.Column("oracle_service_name", sa.String(), nullable=True),
        # Sync settings
        sa.Column("sync_products", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("sync_production_orders", sa.Boolean(), nullable=True, server_default="true"),
        sa.Column("sync_inventory", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column("sync_interval_minutes", sa.Integer(), nullable=True, server_default="60"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(), nullable=True),
        sa.Column("last_sync_message", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_erp_integrations_factory", "erp_integrations", ["factory_id"])


def downgrade() -> None:
    op.drop_index("ix_erp_integrations_factory")
    op.drop_table("erp_integrations")
