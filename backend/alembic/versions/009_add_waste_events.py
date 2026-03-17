"""Add waste_events table for 8-wastes (TIMWOODS) tracking

Revision ID: 009_add_waste_events
Revises: 008_manufacturing_enhancements
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = "009_add_waste_events"
down_revision = "008_manufacturing_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waste_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("reported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("waste_type", sa.String(50), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_cost", sa.Float(), default=0),
        sa.Column("estimated_time_minutes", sa.Integer(), default=0),
        sa.Column("severity", sa.String(20), default="medium"),
        sa.Column("status", sa.String(20), default="open"),
        sa.Column("root_cause", sa.Text(), nullable=True),
        sa.Column("countermeasure", sa.Text(), nullable=True),
        sa.Column("linked_kaizen_id", sa.Integer(), sa.ForeignKey("kaizen_items.id"), nullable=True),
        sa.Column("date_occurred", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_waste_events_factory_id", "waste_events", ["factory_id"])
    op.create_index("ix_waste_events_waste_type", "waste_events", ["waste_type"])
    op.create_index("ix_waste_events_date_occurred", "waste_events", ["date_occurred"])


def downgrade() -> None:
    op.drop_index("ix_waste_events_date_occurred", table_name="waste_events")
    op.drop_index("ix_waste_events_waste_type", table_name="waste_events")
    op.drop_index("ix_waste_events_factory_id", table_name="waste_events")
    op.drop_table("waste_events")
