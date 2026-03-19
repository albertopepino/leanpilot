"""Add performance indexes for common query patterns

Revision ID: 017
Revises: 016
"""
from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def _safe_create_index(index_name: str, table_name: str, columns: list[str]) -> None:
    """Create an index, silently skipping if it already exists."""
    try:
        op.create_index(index_name, table_name, columns)
    except Exception:
        pass


def upgrade() -> None:
    # production_records (no factory_id column — queries join via production_line)
    _safe_create_index("ix_production_records_production_line_id", "production_records", ["production_line_id"])
    _safe_create_index("ix_production_records_date", "production_records", ["date"])

    # oee_records
    _safe_create_index("ix_oee_records_production_line_id", "oee_records", ["production_line_id"])
    _safe_create_index("ix_oee_records_date", "oee_records", ["date"])

    # downtime_events
    _safe_create_index("ix_downtime_events_production_line_id", "downtime_events", ["production_line_id"])

    # kaizen_items
    _safe_create_index("ix_kaizen_items_factory_id", "kaizen_items", ["factory_id"])

    # five_why_analyses
    _safe_create_index("ix_five_why_analyses_factory_id", "five_why_analyses", ["factory_id"])

    # ishikawa_analyses
    _safe_create_index("ix_ishikawa_analyses_factory_id", "ishikawa_analyses", ["factory_id"])

    # smed_records
    _safe_create_index("ix_smed_records_factory_id", "smed_records", ["factory_id"])

    # six_s_audits
    _safe_create_index("ix_six_s_audits_factory_id", "six_s_audits", ["factory_id"])

    # gemba_walks
    _safe_create_index("ix_gemba_walks_factory_id", "gemba_walks", ["factory_id"])

    # tpm_equipment
    _safe_create_index("ix_tpm_equipment_factory_id", "tpm_equipment", ["factory_id"])

    # products
    _safe_create_index("ix_products_factory_id", "products", ["factory_id"])

    # production_orders
    _safe_create_index("ix_production_orders_factory_id", "production_orders", ["factory_id"])

    # scrap_records
    _safe_create_index("ix_scrap_records_production_line_id", "scrap_records", ["production_line_id"])

    # a3_reports
    _safe_create_index("ix_a3_reports_factory_id", "a3_reports", ["factory_id"])

    # vsm_maps
    _safe_create_index("ix_vsm_maps_factory_id", "vsm_maps", ["factory_id"])

    # andon_events
    _safe_create_index("ix_andon_events_factory_id", "andon_events", ["factory_id"])

    # qc_records
    _safe_create_index("ix_qc_records_factory_id", "qc_records", ["factory_id"])

    # non_conformance_reports (actual table name, not ncr_records)
    _safe_create_index("ix_non_conformance_reports_factory_id", "non_conformance_reports", ["factory_id"])

    # capa_actions (actual table name, not capa_records)
    _safe_create_index("ix_capa_actions_factory_id", "capa_actions", ["factory_id"])


def downgrade() -> None:
    for idx in [
        "ix_capa_actions_factory_id",
        "ix_non_conformance_reports_factory_id",
        "ix_qc_records_factory_id",
        "ix_andon_events_factory_id",
        "ix_vsm_maps_factory_id",
        "ix_a3_reports_factory_id",
        "ix_scrap_records_production_line_id",
        "ix_production_orders_factory_id",
        "ix_products_factory_id",
        "ix_tpm_equipment_factory_id",
        "ix_gemba_walks_factory_id",
        "ix_six_s_audits_factory_id",
        "ix_smed_records_factory_id",
        "ix_ishikawa_analyses_factory_id",
        "ix_five_why_analyses_factory_id",
        "ix_kaizen_items_factory_id",
        "ix_downtime_events_production_line_id",
        "ix_oee_records_date",
        "ix_oee_records_production_line_id",
        "ix_production_records_date",
        "ix_production_records_production_line_id",
    ]:
        try:
            op.drop_index(idx)
        except Exception:
            pass
