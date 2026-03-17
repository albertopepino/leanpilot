"""Add session tracking columns to users table

Revision ID: 006_session_tracking
Revises: 005_totp_2fa
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "006_session_tracking"
down_revision = "005_totp_2fa"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("last_login_ip", sa.String(45), nullable=True))
    op.add_column("users", sa.Column("last_user_agent", sa.String(512), nullable=True))


def downgrade():
    op.drop_column("users", "last_user_agent")
    op.drop_column("users", "last_login_ip")
