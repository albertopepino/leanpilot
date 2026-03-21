"""Add photo_url columns to safety_incidents, non_conformance_reports, capa_actions

Revision ID: 030
Revises: 029
"""
from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("safety_incidents", sa.Column("photo_url", sa.String(), nullable=True))
    op.add_column("non_conformance_reports", sa.Column("photo_url", sa.String(), nullable=True))
    op.add_column("capa_actions", sa.Column("photo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("capa_actions", "photo_url")
    op.drop_column("non_conformance_reports", "photo_url")
    op.drop_column("safety_incidents", "photo_url")
