"""Company settings table for branding (logo upload).

Revision ID: 004_company_settings
Revises: 003_mfg_qc
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "004_company_settings"
down_revision = "003_mfg_qc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("logo_filename", sa.String(), nullable=True),
        sa.Column("company_display_name", sa.String(), nullable=True),
        sa.UniqueConstraint("factory_id", name="uq_company_settings_factory"),
    )
    op.create_index("ix_company_settings_factory_id", "company_settings", ["factory_id"])


def downgrade() -> None:
    op.drop_index("ix_company_settings_factory_id")
    op.drop_table("company_settings")
