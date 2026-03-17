"""GDPR compliance: user consent fields, audit tables, account security

Revision ID: 001_gdpr
Revises: None
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = "001_gdpr"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- User table: GDPR consent fields ---
    op.add_column("users", sa.Column("privacy_policy_accepted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("consent_version", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("ai_consent", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("marketing_consent", sa.Boolean(), server_default="false", nullable=False))

    # --- User table: Soft delete (GDPR Art. 17) ---
    op.add_column("users", sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("deletion_requested_at", sa.DateTime(), nullable=True))

    # --- User table: Account security ---
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("password_changed_at", sa.DateTime(), nullable=True))

    # --- Audit log table (immutable) ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_email", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=True),
        sa.Column("factory_id", sa.Integer(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("metadata_", sa.JSON(), nullable=True),
        sa.Column("legal_basis", sa.String(), nullable=True),
        sa.Column("data_categories", sa.String(), nullable=True),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_factory_id", "audit_logs", ["factory_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])

    # --- Consent records table (immutable, GDPR Art. 7) ---
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("consent_type", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("version", sa.String(20), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
    )
    op.create_index("ix_consent_records_user_id", "consent_records", ["user_id"])


def downgrade() -> None:
    op.drop_table("consent_records")
    op.drop_table("audit_logs")

    columns_to_drop = [
        "privacy_policy_accepted_at", "terms_accepted_at", "consent_version",
        "ai_consent", "marketing_consent",
        "is_deleted", "deleted_at", "deletion_requested_at",
        "failed_login_attempts", "locked_until", "last_login_at", "password_changed_at",
    ]
    for col in columns_to_drop:
        op.drop_column("users", col)
