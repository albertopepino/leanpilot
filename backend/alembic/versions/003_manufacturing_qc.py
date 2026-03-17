"""Manufacturing tree and Quality Control module tables.

Adds: work_centers, products, bom_headers, bom_components, production_orders,
      defect_catalog, qc_templates, qc_template_items, qc_records,
      qc_check_results, non_conformance_reports, capa_actions.
Also adds nullable FK columns to existing tables (production_records,
scrap_records, andon_events, hourly_production).

Revision ID: 003_mfg_qc
Revises: 002_lean_tools
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = "003_mfg_qc"
down_revision = "002_lean_tools"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ MANUFACTURING TREE ═══

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("unit_of_measure", sa.String(), server_default="pcs"),
        sa.Column("product_family", sa.String()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
    )

    op.create_table(
        "work_centers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("machine_type", sa.String()),
        sa.Column("capacity_units_per_hour", sa.Float()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
    )

    op.create_table(
        "bom_headers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("version", sa.String(), server_default="1.0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("ideal_cycle_time_sec", sa.Float(), nullable=False),
        sa.Column("batch_size", sa.Integer()),
        sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime()),
        sa.Column("notes", sa.Text()),
    )

    op.create_table(
        "bom_components",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("bom_id", sa.Integer(), sa.ForeignKey("bom_headers.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), server_default="0"),
        sa.Column("material_code", sa.String()),
        sa.Column("material_name", sa.String(), nullable=False),
        sa.Column("quantity_per_unit", sa.Float(), nullable=False),
        sa.Column("unit_of_measure", sa.String()),
        sa.Column("is_critical", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("notes", sa.Text()),
    )

    op.create_table(
        "production_orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("bom_id", sa.Integer(), sa.ForeignKey("bom_headers.id")),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("closed_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("order_number", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="planned"),
        sa.Column("planned_quantity", sa.Integer(), nullable=False),
        sa.Column("actual_quantity_good", sa.Integer(), server_default="0"),
        sa.Column("actual_quantity_scrap", sa.Integer(), server_default="0"),
        sa.Column("planned_start", sa.DateTime()),
        sa.Column("planned_end", sa.DateTime()),
        sa.Column("actual_start", sa.DateTime()),
        sa.Column("actual_end", sa.DateTime()),
        sa.Column("customer_ref", sa.String()),
        sa.Column("notes", sa.Text()),
        sa.Column("qc_hold", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("qc_hold_reason", sa.Text()),
        sa.Column("closed_at", sa.DateTime()),
    )
    op.create_index("ix_production_orders_order_number", "production_orders", ["order_number"])
    op.create_index("ix_production_orders_status", "production_orders", ["production_line_id", "status"])

    # ═══ QUALITY CONTROL ═══

    op.create_table(
        "defect_catalog",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id")),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("severity", sa.String(), server_default="minor"),
        sa.Column("category", sa.String()),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
    )

    op.create_table(
        "qc_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id")),
        sa.Column("work_center_id", sa.Integer(), sa.ForeignKey("work_centers.id")),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("template_type", sa.String(), nullable=False),
        sa.Column("version", sa.String(), server_default="1.0"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("estimated_time_min", sa.Integer()),
        sa.Column("description", sa.Text()),
        sa.Column("pass_threshold_pct", sa.Float(), server_default="100.0"),
        sa.Column("critical_items_must_pass", sa.Boolean(), server_default=sa.text("true")),
    )

    op.create_table(
        "qc_template_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("qc_templates.id"), nullable=False),
        sa.Column("item_order", sa.Integer(), nullable=False),
        sa.Column("category", sa.String()),
        sa.Column("check_type", sa.String(), server_default="checkbox"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("specification", sa.Text()),
        sa.Column("lower_limit", sa.Float()),
        sa.Column("upper_limit", sa.Float()),
        sa.Column("unit", sa.String()),
        sa.Column("is_critical", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("is_mandatory", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("reference_photo_url", sa.String()),
    )

    op.create_table(
        "qc_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("qc_templates.id"), nullable=False),
        sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id")),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id"), nullable=False),
        sa.Column("production_record_id", sa.Integer(), sa.ForeignKey("production_records.id")),
        sa.Column("performed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("check_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="in_progress"),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("overall_score_pct", sa.Float()),
        sa.Column("andon_triggered", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("andon_event_id", sa.Integer(), sa.ForeignKey("andon_events.id")),
        sa.Column("hold_placed", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("hold_released_at", sa.DateTime()),
        sa.Column("hold_released_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("hold_release_notes", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("sample_size", sa.Integer()),
        sa.Column("sample_number", sa.Integer()),
    )
    op.create_index("ix_qc_records_po", "qc_records", ["production_order_id"])

    op.create_table(
        "qc_check_results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("qc_record_id", sa.Integer(), sa.ForeignKey("qc_records.id"), nullable=False),
        sa.Column("template_item_id", sa.Integer(), sa.ForeignKey("qc_template_items.id"), nullable=False),
        sa.Column("result", sa.String(), nullable=False),
        sa.Column("measured_value", sa.Float()),
        sa.Column("text_value", sa.Text()),
        sa.Column("photo_url", sa.String()),
        sa.Column("notes", sa.Text()),
        sa.Column("defect_catalog_id", sa.Integer(), sa.ForeignKey("defect_catalog.id")),
    )
    op.create_index("ix_qc_check_results_defect", "qc_check_results", ["defect_catalog_id"])

    op.create_table(
        "non_conformance_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id")),
        sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id")),
        sa.Column("qc_record_id", sa.Integer(), sa.ForeignKey("qc_records.id")),
        sa.Column("raised_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")),
        sa.Column("defect_catalog_id", sa.Integer(), sa.ForeignKey("defect_catalog.id")),
        sa.Column("five_why_id", sa.Integer(), sa.ForeignKey("five_why_analyses.id")),
        sa.Column("closed_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("ncr_number", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("status", sa.String(), server_default="open"),
        sa.Column("detected_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("quantity_affected", sa.Integer()),
        sa.Column("disposition", sa.String()),
        sa.Column("disposition_notes", sa.Text()),
        sa.Column("root_cause", sa.Text()),
        sa.Column("closed_at", sa.DateTime()),
    )
    op.create_index("ix_ncr_number", "non_conformance_reports", ["ncr_number"])

    op.create_table(
        "capa_actions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("factory_id", sa.Integer(), sa.ForeignKey("factories.id"), nullable=False),
        sa.Column("ncr_id", sa.Integer(), sa.ForeignKey("non_conformance_reports.id")),
        sa.Column("production_line_id", sa.Integer(), sa.ForeignKey("production_lines.id")),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("verified_by_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("kaizen_item_id", sa.Integer(), sa.ForeignKey("kaizen_items.id")),
        sa.Column("capa_number", sa.String(), nullable=False),
        sa.Column("capa_type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("root_cause", sa.Text()),
        sa.Column("status", sa.String(), server_default="open"),
        sa.Column("priority", sa.String(), server_default="medium"),
        sa.Column("due_date", sa.DateTime()),
        sa.Column("implemented_at", sa.DateTime()),
        sa.Column("verified_at", sa.DateTime()),
        sa.Column("effectiveness_check_date", sa.DateTime()),
        sa.Column("effectiveness_result", sa.Text()),
    )
    op.create_index("ix_capa_number", "capa_actions", ["capa_number"])

    # ═══ ADD NULLABLE FKs TO EXISTING TABLES ═══

    # production_records: link to PO and product
    op.add_column("production_records", sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id")))
    op.add_column("production_records", sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id")))
    op.create_index("ix_production_records_po", "production_records", ["production_order_id"])

    # scrap_records: link to defect catalog and PO
    op.add_column("scrap_records", sa.Column("defect_catalog_id", sa.Integer(), sa.ForeignKey("defect_catalog.id")))
    op.add_column("scrap_records", sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id")))

    # andon_events: QC trigger metadata
    op.add_column("andon_events", sa.Column("source", sa.String()))
    op.add_column("andon_events", sa.Column("qc_record_id", sa.Integer(), sa.ForeignKey("qc_records.id")))
    op.add_column("andon_events", sa.Column("trigger_type", sa.String()))

    # hourly_production: link to PO
    op.add_column("hourly_production", sa.Column("production_order_id", sa.Integer(), sa.ForeignKey("production_orders.id")))


def downgrade() -> None:
    # Remove FK columns from existing tables
    op.drop_column("hourly_production", "production_order_id")
    op.drop_column("andon_events", "trigger_type")
    op.drop_column("andon_events", "qc_record_id")
    op.drop_column("andon_events", "source")
    op.drop_column("scrap_records", "production_order_id")
    op.drop_column("scrap_records", "defect_catalog_id")
    op.drop_column("production_records", "product_id")
    op.drop_column("production_records", "production_order_id")

    # Drop new tables (reverse order)
    op.drop_table("capa_actions")
    op.drop_table("non_conformance_reports")
    op.drop_table("qc_check_results")
    op.drop_table("qc_records")
    op.drop_table("qc_template_items")
    op.drop_table("qc_templates")
    op.drop_table("defect_catalog")
    op.drop_table("production_orders")
    op.drop_table("bom_components")
    op.drop_table("bom_headers")
    op.drop_table("work_centers")
    op.drop_table("products")
