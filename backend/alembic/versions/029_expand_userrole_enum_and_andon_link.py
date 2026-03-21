"""Expand UserRole enum with 5 new roles and add andon_event_id to safety_incidents

Revision ID: 029
Revises: 028
"""
from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing roles to the userrole PostgreSQL enum
    # ALTER TYPE ... ADD VALUE is not transactional in Postgres, so we run
    # each statement outside the transaction block.
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'production_manager'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'quality_manager'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'quality_supervisor'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'quality_inspector'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'maintenance'")

    # Add andon_event_id FK to safety_incidents
    op.add_column(
        "safety_incidents",
        sa.Column("andon_event_id", sa.Integer(), sa.ForeignKey("andon_events.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("safety_incidents", "andon_event_id")
    # Note: PostgreSQL does not support DROP VALUE from enums.
    # To fully revert, you would need to recreate the enum type.
