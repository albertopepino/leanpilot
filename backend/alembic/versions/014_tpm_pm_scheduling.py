"""Add maintenance_interval_days to tpm_equipment for PM auto-scheduling

Revision ID: 016
Revises: 015
"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tpm_equipment",
        sa.Column("maintenance_interval_days", sa.Integer(), server_default="30", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tpm_equipment", "maintenance_interval_days")
