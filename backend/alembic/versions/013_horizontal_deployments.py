"""Phase 4: Horizontal deployment tracking

Revision ID: 013
Revises: 012
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "horizontal_deployments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("target_lines", sa.JSON(), default=[]),
        sa.Column("completed_lines", sa.JSON(), default=[]),
        sa.Column("deployed_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(), server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("horizontal_deployments")
