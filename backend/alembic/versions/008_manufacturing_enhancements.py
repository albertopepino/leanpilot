"""Add labor_minutes_per_unit to products, create bom_operations and production_order_lines tables

Revision ID: 008_manufacturing_enhancements
Revises: 007_group_policies
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = "008_manufacturing_enhancements"
down_revision = "007_group_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add labor_minutes_per_unit to products
    op.add_column("products", sa.Column("labor_minutes_per_unit", sa.Float(), nullable=True))

    # Create bom_operations table
    op.create_table(
        "bom_operations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("bom_id", sa.Integer(), sa.ForeignKey("bom_headers.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), default=0),
        sa.Column("work_center_id", sa.Integer(), sa.ForeignKey("work_centers.id"), nullable=True),
        sa.Column("operation_name", sa.String(), nullable=False),
        sa.Column("cycle_time_seconds", sa.Float(), nullable=False),
        sa.Column("cycle_time_basis", sa.String(), default="per_piece"),
        sa.Column("labor_minutes", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create production_order_lines table
    op.create_table(
        "production_order_lines",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("production_orders.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("bom_id", sa.Integer(), sa.ForeignKey("bom_headers.id"), nullable=True),
        sa.Column("planned_quantity", sa.Integer(), nullable=False),
        sa.Column("actual_quantity_good", sa.Integer(), default=0),
        sa.Column("actual_quantity_scrap", sa.Integer(), default=0),
        sa.Column("status", sa.String(), default="planned"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("production_order_lines")
    op.drop_table("bom_operations")
    op.drop_column("products", "labor_minutes_per_unit")
