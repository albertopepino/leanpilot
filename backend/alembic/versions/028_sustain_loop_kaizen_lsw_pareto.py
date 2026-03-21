"""Add lsw_id, pareto_rank, countermeasure to kaizen_items for sustain loop

Revision ID: 028
Revises: 027
"""
from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "kaizen_items",
        sa.Column("lsw_id", sa.Integer(), sa.ForeignKey("leader_standard_work.id"), nullable=True),
    )
    op.add_column(
        "kaizen_items",
        sa.Column("pareto_rank", sa.Integer(), nullable=True),
    )
    op.add_column(
        "kaizen_items",
        sa.Column("countermeasure", sa.Text(), nullable=True),
    )
    op.create_index("ix_kaizen_items_lsw_id", "kaizen_items", ["lsw_id"])
    op.create_index("ix_kaizen_items_pareto_rank", "kaizen_items", ["pareto_rank"])


def downgrade() -> None:
    op.drop_index("ix_kaizen_items_pareto_rank", table_name="kaizen_items")
    op.drop_index("ix_kaizen_items_lsw_id", table_name="kaizen_items")
    op.drop_column("kaizen_items", "countermeasure")
    op.drop_column("kaizen_items", "pareto_rank")
    op.drop_column("kaizen_items", "lsw_id")
