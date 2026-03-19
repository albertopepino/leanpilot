"""Add batch_lot_number to production_orders and non_conformance_reports

Revision ID: 021
Revises: 020
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"


def upgrade():
    op.add_column("production_orders", sa.Column("batch_lot_number", sa.String(), nullable=True))
    op.add_column("non_conformance_reports", sa.Column("batch_lot_number", sa.String(), nullable=True))


def downgrade():
    op.drop_column("non_conformance_reports", "batch_lot_number")
    op.drop_column("production_orders", "batch_lot_number")
