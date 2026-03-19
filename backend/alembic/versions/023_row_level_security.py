"""Enable Postgres Row Level Security on all tenant-scoped tables.

Every table that carries a factory_id column gets:
  1. RLS enabled (ALTER TABLE … ENABLE ROW LEVEL SECURITY)
  2. FORCE RLS so even table owners are subject to the policies
  3. A tenant isolation policy: rows visible only when
     current_setting('app.current_factory_id')::integer matches factory_id
  4. An admin bypass policy: when current_setting('app.is_admin', true) = 'true'
     the full table is accessible (superuser / admin operations)

The application layer MUST execute
  SET LOCAL app.current_factory_id = '<id>';
  SET LOCAL app.is_admin = 'true';   -- only for admin users
at the start of every transaction for RLS to allow access.

Revision ID: 023
Revises: 022
"""
from alembic import op

revision = "023"
down_revision = "022"

# ---------------------------------------------------------------------------
# All tables that have a factory_id column — sorted alphabetically.
# ---------------------------------------------------------------------------
RLS_TABLES = [
    "a3_reports",
    "ai_conversations",
    "ai_kaizen_suggestions",
    "andon_events",
    "audit_logs",
    "audit_schedules",
    "bom_headers",
    "capa_actions",
    "cilt_standards",
    "company_settings",
    "defect_catalog",
    "five_why_analyses",
    "gemba_walks",
    "groups",
    "horizontal_deployments",
    "ishikawa_analyses",
    "kaizen_items",
    "kanban_boards",
    "kanban_cards",
    "leader_standard_work",
    "lean_assessments",
    "mind_maps",
    "non_conformance_reports",
    "notifications",
    "pokayoke_devices",
    "pokayoke_verifications",
    "production_lines",
    "production_orders",
    "products",
    "qc_policy_documents",
    "qc_records",
    "qc_templates",
    "safety_incidents",
    "shift_handovers",
    "six_s_audits",
    "smed_records",
    "sqcdp_entries",
    "sqcdp_meetings",
    "tpm_equipment",
    "users",
    "vsm_maps",
    "waste_events",
    "work_centers",
]


def upgrade():
    for table in RLS_TABLES:
        # 1. Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        # 2. Force RLS even for table owners
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

        # 3. Tenant isolation policy — all DML operations
        op.execute(f"""
            CREATE POLICY tenant_isolation_{table} ON {table}
            FOR ALL
            USING (
                factory_id = current_setting('app.current_factory_id', true)::integer
            )
            WITH CHECK (
                factory_id = current_setting('app.current_factory_id', true)::integer
            )
        """)

        # 4. Admin bypass policy — full access when app.is_admin is 'true'
        op.execute(f"""
            CREATE POLICY admin_bypass_{table} ON {table}
            FOR ALL
            USING (
                current_setting('app.is_admin', true) = 'true'
            )
            WITH CHECK (
                current_setting('app.is_admin', true) = 'true'
            )
        """)


def downgrade():
    for table in RLS_TABLES:
        # Drop policies (order doesn't matter)
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{table} ON {table}")
        op.execute(f"DROP POLICY IF EXISTS admin_bypass_{table} ON {table}")

        # Disable forced RLS, then disable RLS
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
