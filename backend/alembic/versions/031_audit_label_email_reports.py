"""Add audit_label and email report settings to company_settings

Revision ID: 031
Revises: 030
"""
from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("company_settings", sa.Column("audit_label", sa.String(), nullable=True, server_default="6S"))
    op.add_column("company_settings", sa.Column("email_reports_enabled", sa.Boolean(), nullable=True, server_default="false"))
    op.add_column("company_settings", sa.Column("daily_oee_recipients", sa.JSON(), nullable=True))
    op.add_column("company_settings", sa.Column("weekly_kaizen_recipients", sa.JSON(), nullable=True))
    op.add_column("company_settings", sa.Column("report_timezone", sa.String(), nullable=True, server_default="UTC"))


def downgrade() -> None:
    op.drop_column("company_settings", "report_timezone")
    op.drop_column("company_settings", "weekly_kaizen_recipients")
    op.drop_column("company_settings", "daily_oee_recipients")
    op.drop_column("company_settings", "email_reports_enabled")
    op.drop_column("company_settings", "audit_label")
