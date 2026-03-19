"""Phase 1-4: SQCDP, Shift Handover, Notifications, LSW, Audit Schedules

Revision ID: 011
Revises: 010_audit_fixes
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010_audit_fixes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQCDP Entries
    op.create_table(
        "sqcdp_entries",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="green"),
        sa.Column("metric_value", sa.Float(), nullable=True),
        sa.Column("target_value", sa.Float(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("action_required", sa.Boolean(), server_default="false"),
        sa.Column("action_owner", sa.String(), nullable=True),
        sa.Column("action_due_date", sa.Date(), nullable=True),
        sa.Column("tier_level", sa.Integer(), server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sqcdp_entries_factory_date", "sqcdp_entries", ["factory_id", "date"])

    # SQCDP Meetings
    op.create_table(
        "sqcdp_meetings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("led_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("tier_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_min", sa.Integer(), nullable=True),
        sa.Column("attendee_count", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("action_items", sa.JSON(), server_default="[]"),
        sa.Column("escalated_items", sa.JSON(), server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Shift Handovers
    op.create_table(
        "shift_handovers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("outgoing_shift_id", sa.Integer(), sa.ForeignKey("shifts.id"), nullable=True),
        sa.Column("incoming_shift_id", sa.Integer(), sa.ForeignKey("shifts.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("acknowledged_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), server_default="draft"),
        sa.Column("total_pieces", sa.Integer(), nullable=True),
        sa.Column("good_pieces", sa.Integer(), nullable=True),
        sa.Column("scrap_pieces", sa.Integer(), nullable=True),
        sa.Column("oee_pct", sa.Float(), nullable=True),
        sa.Column("downtime_min", sa.Float(), nullable=True),
        sa.Column("safety_issues", sa.Text(), nullable=True),
        sa.Column("quality_issues", sa.Text(), nullable=True),
        sa.Column("equipment_issues", sa.Text(), nullable=True),
        sa.Column("material_issues", sa.Text(), nullable=True),
        sa.Column("pending_actions", sa.JSON(), server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_shift_handovers_factory_date", "shift_handovers", ["factory_id", "date"])

    # Notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("notification_type", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default="false"),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_email_sent", sa.Boolean(), server_default="false"),
        sa.Column("source_type", sa.String(50), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])

    # Leader Standard Work
    op.create_table(
        "leader_standard_work",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("frequency", sa.String(20), server_default="daily"),
        sa.Column("estimated_time_min", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("tasks", sa.JSON(), server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # LSW Completions
    op.create_table(
        "lsw_completions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("lsw_id", sa.Integer(), sa.ForeignKey("leader_standard_work.id"), nullable=False),
        sa.Column("completed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("completed_tasks", sa.JSON(), server_default="[]"),
        sa.Column("completion_pct", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Audit Schedules
    op.create_table(
        "audit_schedules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("audit_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("area", sa.String(), nullable=True),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("frequency", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("last_completed_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("escalation_days", sa.Integer(), server_default="2"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_schedules")
    op.drop_table("lsw_completions")
    op.drop_table("leader_standard_work")
    op.drop_table("notifications")
    op.drop_table("shift_handovers")
    op.drop_table("sqcdp_meetings")
    op.drop_table("sqcdp_entries")
