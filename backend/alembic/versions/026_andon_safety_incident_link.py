"""Add safety_incident_id FK to andon_events for cross-tool integration

Revision ID: 026
Revises: 025
"""
from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "andon_events",
        sa.Column("safety_incident_id", sa.Integer(), sa.ForeignKey("safety_incidents.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("andon_events", "safety_incident_id")
