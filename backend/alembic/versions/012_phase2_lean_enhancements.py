"""Phase 2: Lean tool enhancements — new columns for Kaizen, 5-Why, VSM, Gemba, 6S

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Kaizen enhancements
    op.add_column("kaizen_items", sa.Column("before_photo_url", sa.String(), nullable=True))
    op.add_column("kaizen_items", sa.Column("after_photo_url", sa.String(), nullable=True))
    op.add_column("kaizen_items", sa.Column("effort_level", sa.String(), nullable=True))
    op.add_column("kaizen_items", sa.Column("impact_level", sa.String(), nullable=True))
    op.add_column("kaizen_items", sa.Column("is_blitz", sa.Boolean(), server_default="false"))
    op.add_column("kaizen_items", sa.Column("standardized", sa.Boolean(), server_default="false"))
    op.add_column("kaizen_items", sa.Column("source_type", sa.String(), nullable=True))
    op.add_column("kaizen_items", sa.Column("source_id", sa.Integer(), nullable=True))
    op.add_column("kaizen_items", sa.Column("linked_five_why_id", sa.Integer(), sa.ForeignKey("five_why_analyses.id"), nullable=True))

    # 5-Why enhancements
    op.add_column("five_why_analyses", sa.Column("ishikawa_id", sa.Integer(), sa.ForeignKey("ishikawa_analyses.id"), nullable=True))
    op.add_column("five_why_analyses", sa.Column("countermeasure_owner", sa.String(), nullable=True))
    op.add_column("five_why_analyses", sa.Column("countermeasure_deadline", sa.DateTime(timezone=True), nullable=True))
    op.add_column("five_why_analyses", sa.Column("horizontal_deployed", sa.Boolean(), server_default="false"))
    op.add_column("five_why_analyses", sa.Column("horizontal_lines", sa.JSON(), server_default="[]"))
    op.add_column("five_why_analyses", sa.Column("verification_result", sa.Text(), nullable=True))

    # VSM enhancements
    op.add_column("vsm_maps", sa.Column("supplier_name", sa.String(), nullable=True))
    op.add_column("vsm_maps", sa.Column("customer_name", sa.String(), nullable=True))
    op.add_column("vsm_steps", sa.Column("step_type", sa.String(), server_default="process"))
    op.add_column("vsm_steps", sa.Column("value_add", sa.Boolean(), server_default="true"))

    # Gemba enhancements
    op.add_column("gemba_walks", sa.Column("route_id", sa.Integer(), nullable=True))
    op.add_column("gemba_walks", sa.Column("route_name", sa.String(), nullable=True))
    op.add_column("gemba_observations", sa.Column("linked_kaizen_id", sa.Integer(), sa.ForeignKey("kaizen_items.id"), nullable=True))

    # 6S enhancements
    op.add_column("six_s_audit_items", sa.Column("photo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("six_s_audit_items", "photo_url")
    op.drop_column("gemba_observations", "linked_kaizen_id")
    op.drop_column("gemba_walks", "route_name")
    op.drop_column("gemba_walks", "route_id")
    op.drop_column("vsm_steps", "value_add")
    op.drop_column("vsm_steps", "step_type")
    op.drop_column("vsm_maps", "customer_name")
    op.drop_column("vsm_maps", "supplier_name")
    op.drop_column("five_why_analyses", "verification_result")
    op.drop_column("five_why_analyses", "horizontal_lines")
    op.drop_column("five_why_analyses", "horizontal_deployed")
    op.drop_column("five_why_analyses", "countermeasure_deadline")
    op.drop_column("five_why_analyses", "countermeasure_owner")
    op.drop_column("five_why_analyses", "ishikawa_id")
    op.drop_column("kaizen_items", "linked_five_why_id")
    op.drop_column("kaizen_items", "source_id")
    op.drop_column("kaizen_items", "source_type")
    op.drop_column("kaizen_items", "standardized")
    op.drop_column("kaizen_items", "is_blitz")
    op.drop_column("kaizen_items", "impact_level")
    op.drop_column("kaizen_items", "effort_level")
    op.drop_column("kaizen_items", "after_photo_url")
    op.drop_column("kaizen_items", "before_photo_url")
