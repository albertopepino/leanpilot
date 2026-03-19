"""Add escalation tracking columns to andon_events

Revision ID: 018
Revises: 017
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "andon_events",
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "andon_events",
        sa.Column("escalation_count", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("andon_events", "escalation_count")
    op.drop_column("andon_events", "escalated_at")
