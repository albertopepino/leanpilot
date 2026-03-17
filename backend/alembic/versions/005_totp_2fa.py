"""Add TOTP 2FA columns to users table

Revision ID: 005_totp_2fa
Revises: 004_company_settings
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = "005_totp_2fa"
down_revision = "004_company_settings"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("totp_secret", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean(), server_default=sa.text("false"), nullable=True))


def downgrade():
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
