"""Create FMEA analyses and items tables

Revision ID: 034
Revises: 033
"""
from alembic import op
import sqlalchemy as sa

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fmea_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("fmea_type", sa.String(50), server_default="process"),
        sa.Column("product_name", sa.String(255), nullable=True),
        sa.Column("process_name", sa.String(255), nullable=True),
        sa.Column("team_members", sa.String(500), nullable=True),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "fmea_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("fmea_analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("process_step", sa.String(255), nullable=True),
        sa.Column("failure_mode", sa.String(500), nullable=False),
        sa.Column("failure_effect", sa.Text(), nullable=True),
        sa.Column("failure_cause", sa.Text(), nullable=True),
        sa.Column("severity", sa.Integer(), server_default="1"),
        sa.Column("occurrence", sa.Integer(), server_default="1"),
        sa.Column("detection", sa.Integer(), server_default="1"),
        sa.Column("rpn", sa.Integer(), server_default="1"),
        sa.Column("current_controls", sa.Text(), nullable=True),
        sa.Column("recommended_action", sa.Text(), nullable=True),
        sa.Column("responsible", sa.String(255), nullable=True),
        sa.Column("target_date", sa.String(50), nullable=True),
        sa.Column("action_taken", sa.Text(), nullable=True),
        sa.Column("new_severity", sa.Integer(), nullable=True),
        sa.Column("new_occurrence", sa.Integer(), nullable=True),
        sa.Column("new_detection", sa.Integer(), nullable=True),
        sa.Column("new_rpn", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(50), server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_index("ix_fmea_analyses_factory_id", "fmea_analyses", ["factory_id"])
    op.create_index("ix_fmea_items_analysis_id", "fmea_items", ["analysis_id"])


def downgrade() -> None:
    op.drop_table("fmea_items")
    op.drop_table("fmea_analyses")
