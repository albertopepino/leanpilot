"""Add kanban and pokayoke tables

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Kanban Board
    op.create_table(
        "kanban_boards",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("columns", sa.JSON(), nullable=False, server_default='["backlog","in_queue","in_progress","done","shipped"]'),
        sa.Column("wip_limits", sa.JSON(), nullable=False, server_default='{"backlog":0,"in_queue":5,"in_progress":3,"done":10,"shipped":0}'),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_kanban_boards_factory_id", "kanban_boards", ["factory_id"])

    # Kanban Card
    op.create_table(
        "kanban_cards",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("board_id", sa.Integer(), sa.ForeignKey("kanban_boards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("assigned_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("column_name", sa.String(100), nullable=False, server_default="backlog"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("product_name", sa.String(200), nullable=True),
        sa.Column("order_number", sa.String(100), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lead_time_hours", sa.Float(), nullable=True),
        sa.Column("cycle_time_hours", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_kanban_cards_board_id", "kanban_cards", ["board_id"])
    op.create_index("ix_kanban_cards_factory_id", "kanban_cards", ["factory_id"])

    # Poka-Yoke Device
    op.create_table(
        "pokayoke_devices",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("device_type", sa.String(30), nullable=False),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("process_step", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("installation_date", sa.Date(), nullable=True),
        sa.Column("verification_frequency", sa.String(20), nullable=False, server_default="weekly"),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effectiveness_rate", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_pokayoke_devices_factory_id", "pokayoke_devices", ["factory_id"])

    # Poka-Yoke Verification
    op.create_table(
        "pokayoke_verifications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.Integer(), sa.ForeignKey("pokayoke_devices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("verified_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("result", sa.String(10), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_pokayoke_verifications_device_id", "pokayoke_verifications", ["device_id"])
    op.create_index("ix_pokayoke_verifications_factory_id", "pokayoke_verifications", ["factory_id"])


def downgrade() -> None:
    op.drop_table("pokayoke_verifications")
    op.drop_table("pokayoke_devices")
    op.drop_table("kanban_cards")
    op.drop_table("kanban_boards")
