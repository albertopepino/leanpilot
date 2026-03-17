"""Create groups, group_policies, user_groups tables

Revision ID: 007_group_policies
Revises: 006_session_tracking
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = "007_group_policies"
down_revision = "006_session_tracking"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.Column("factory_id", sa.Integer, sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("color", sa.String, nullable=True),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.UniqueConstraint("factory_id", "name", name="uq_group_factory_name"),
    )

    op.create_table(
        "group_policies",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tab_id", sa.String, nullable=False),
        sa.Column("permission", sa.String, nullable=False),
        sa.UniqueConstraint("group_id", "tab_id", name="uq_group_tab"),
    )

    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade():
    op.drop_table("user_groups")
    op.drop_table("group_policies")
    op.drop_table("groups")
