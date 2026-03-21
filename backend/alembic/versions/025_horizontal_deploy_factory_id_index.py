"""Add missing index on horizontal_deployments.factory_id

Revision ID: 025
Revises: 024
"""
from alembic import op

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.create_index(
            "ix_horizontal_deployments_factory_id",
            "horizontal_deployments",
            ["factory_id"],
        )
    except Exception:
        pass  # Index may already exist from model-level index=True


def downgrade() -> None:
    try:
        op.drop_index("ix_horizontal_deployments_factory_id", table_name="horizontal_deployments")
    except Exception:
        pass
