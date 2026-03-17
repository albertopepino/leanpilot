"""Lean tool tables: OEE records, 5 Why, Ishikawa, Kaizen, SMED, LeanAssessment

Revision ID: 002_lean_tools
Revises: 001_gdpr
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = "002_lean_tools"
down_revision = "001_gdpr"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- OEE Records ---
    op.create_table(
        "oee_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("production_record_id", sa.Integer(), sa.ForeignKey("production_records.id"), nullable=True),
        sa.Column("date", sa.DateTime(), nullable=False),
        sa.Column("availability", sa.Float(), nullable=False),
        sa.Column("performance", sa.Float(), nullable=False),
        sa.Column("quality", sa.Float(), nullable=False),
        sa.Column("oee", sa.Float(), nullable=False),
        sa.Column("planned_time_min", sa.Float()),
        sa.Column("run_time_min", sa.Float()),
        sa.Column("total_pieces", sa.Integer()),
        sa.Column("good_pieces", sa.Integer()),
        sa.Column("downtime_min", sa.Float()),
    )
    op.create_index("ix_oee_records_line_date", "oee_records", ["production_line_id", "date"])

    # --- Five Why Analysis ---
    op.create_table(
        "five_why_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("problem_statement", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), default="open"),
        sa.Column("root_cause", sa.Text()),
        sa.Column("countermeasure", sa.Text()),
        sa.Column("responsible", sa.String()),
        sa.Column("due_date", sa.DateTime()),
        sa.Column("verified_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("ai_generated", sa.Boolean(), default=False),
    )
    op.create_index("ix_five_why_factory", "five_why_analyses", ["factory_id"])

    op.create_table(
        "five_why_steps",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("five_why_analyses.id"), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("why_question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
    )

    # --- Ishikawa Analysis ---
    op.create_table(
        "ishikawa_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("effect", sa.Text(), nullable=False),
        sa.Column("conclusion", sa.Text()),
        sa.Column("ai_generated", sa.Boolean(), default=False),
    )
    op.create_index("ix_ishikawa_factory", "ishikawa_analyses", ["factory_id"])

    op.create_table(
        "ishikawa_causes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("ishikawa_analyses.id"), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("cause", sa.Text(), nullable=False),
        sa.Column("sub_cause", sa.Text()),
        sa.Column("is_root_cause", sa.Boolean(), default=False),
    )

    # --- Kaizen Items ---
    op.create_table(
        "kaizen_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String()),
        sa.Column("priority", sa.String(), default="medium"),
        sa.Column("status", sa.String(), default="idea"),
        sa.Column("expected_impact", sa.Text()),
        sa.Column("expected_savings_eur", sa.Float()),
        sa.Column("actual_savings_eur", sa.Float()),
        sa.Column("start_date", sa.DateTime()),
        sa.Column("target_date", sa.DateTime()),
        sa.Column("completion_date", sa.DateTime()),
        sa.Column("ai_generated", sa.Boolean(), default=False),
        sa.Column("ai_confidence", sa.Float()),
    )
    op.create_index("ix_kaizen_factory", "kaizen_items", ["factory_id"])

    # --- SMED Records ---
    op.create_table(
        "smed_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("changeover_name", sa.String(), nullable=False),
        sa.Column("baseline_time_min", sa.Float(), nullable=False),
        sa.Column("current_time_min", sa.Float()),
        sa.Column("target_time_min", sa.Float()),
        sa.Column("date_recorded", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_smed_factory", "smed_records", ["factory_id"])

    op.create_table(
        "smed_steps",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("record_id", sa.Integer(), sa.ForeignKey("smed_records.id"), nullable=False),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Float(), nullable=False),
        sa.Column("phase", sa.String(), nullable=False),
        sa.Column("can_be_externalized", sa.Boolean(), default=False),
        sa.Column("improvement_notes", sa.Text()),
    )

    # --- Lean Assessment ---
    op.create_table(
        "lean_assessments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("assessed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("scores", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("overall_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("maturity_level", sa.String(), nullable=False, server_default=""),
        sa.Column("recommendations", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("answers", sa.JSON(), nullable=False, server_default="{}"),
    )
    op.create_index("ix_lean_assessment_factory", "lean_assessments", ["factory_id"])


def downgrade() -> None:
    op.drop_table("lean_assessments")
    op.drop_table("smed_steps")
    op.drop_table("smed_records")
    op.drop_table("kaizen_items")
    op.drop_table("ishikawa_causes")
    op.drop_table("ishikawa_analyses")
    op.drop_table("five_why_steps")
    op.drop_table("five_why_analyses")
    op.drop_table("oee_records")
