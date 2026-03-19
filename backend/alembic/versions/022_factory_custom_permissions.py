"""Add custom_permissions JSON to factories

Revision ID: 022
Revises: 021
"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"


def upgrade():
    op.add_column("factories", sa.Column("custom_permissions", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("factories", "custom_permissions")
