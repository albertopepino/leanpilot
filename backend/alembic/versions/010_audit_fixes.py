"""Audit fixes: password reset tokens, waste cost precision

Revision ID: 010_audit_fixes
Revises: 009_add_waste_events
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = "010_audit_fixes"
down_revision = "009_add_waste_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Password reset token fields on users table
    op.add_column("users", sa.Column("reset_token", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_users_reset_token", "users", ["reset_token"], unique=True)

    # Change estimated_cost from Float to Numeric(12,2) for monetary precision
    op.alter_column(
        "waste_events",
        "estimated_cost",
        type_=sa.Numeric(12, 2),
        existing_type=sa.Float(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "waste_events",
        "estimated_cost",
        type_=sa.Float(),
        existing_type=sa.Numeric(12, 2),
        existing_nullable=True,
    )
    op.drop_index("ix_users_reset_token", table_name="users")
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token")
