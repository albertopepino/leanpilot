"""Add mentor review columns to a3_reports

Revision ID: 015
Revises: 014
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("a3_reports", sa.Column("mentor_name", sa.String(), nullable=True))
    op.add_column("a3_reports", sa.Column("mentor_date", sa.String(), nullable=True))
    op.add_column("a3_reports", sa.Column("mentor_feedback", sa.Text(), nullable=True))
    op.add_column("a3_reports", sa.Column("mentor_status", sa.String(), nullable=True, server_default="draft"))


def downgrade() -> None:
    op.drop_column("a3_reports", "mentor_status")
    op.drop_column("a3_reports", "mentor_feedback")
    op.drop_column("a3_reports", "mentor_date")
    op.drop_column("a3_reports", "mentor_name")
