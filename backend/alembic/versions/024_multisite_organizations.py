"""Multi-site organizations — add organizations table, user_site_roles table,
and organization_id + site_code to factories.

Migrates existing data: creates a default organization for each factory and
creates UserSiteRole entries from existing user.factory_id + user.role.

Revision ID: 024
Revises: 023
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"


def upgrade():
    # 1. Create organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("subscription_tier", sa.String(50), server_default="starter", nullable=False),
        sa.Column("max_sites", sa.Integer(), server_default="1", nullable=False),
        sa.Column("max_users", sa.Integer(), server_default="10", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Add organization_id and site_code to factories
    op.add_column("factories", sa.Column("organization_id", sa.Integer(), nullable=True))
    op.add_column("factories", sa.Column("site_code", sa.String(20), nullable=True))
    op.create_foreign_key(
        "fk_factories_organization_id",
        "factories",
        "organizations",
        ["organization_id"],
        ["id"],
    )
    op.create_index("ix_factories_organization_id", "factories", ["organization_id"])

    # 3. Create user_site_roles table
    op.create_table(
        "user_site_roles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("factories.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("scope_line_ids", sa.JSON(), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "site_id", "role", name="uq_user_site_role"),
    )

    # 4. Data migration: create a default org per factory, link them, create user roles
    conn = op.get_bind()

    # Get all factories
    factories = conn.execute(sa.text("SELECT id, name FROM factories")).fetchall()

    for factory in factories:
        factory_id = factory[0]
        factory_name = factory[1]
        # Create slug from factory name (lowercase, replace spaces with hyphens)
        # Truncate AFTER appending suffix so total never exceeds 100 chars
        suffix = f"-{factory_id}"
        max_base = 100 - len(suffix)
        slug = factory_name.lower().replace(" ", "-").replace("'", "")[:max_base]
        slug = f"{slug}{suffix}"

        # Insert organization
        result = conn.execute(
            sa.text(
                "INSERT INTO organizations (name, slug, subscription_tier, max_sites, max_users, is_active) "
                "VALUES (:name, :slug, 'starter', 3, 50, true) RETURNING id"
            ),
            {"name": factory_name, "slug": slug},
        )
        org_id = result.fetchone()[0]

        # Link factory to organization
        conn.execute(
            sa.text("UPDATE factories SET organization_id = :org_id WHERE id = :fid"),
            {"org_id": org_id, "fid": factory_id},
        )

        # Create UserSiteRole entries from existing users
        users = conn.execute(
            sa.text("SELECT id, role FROM users WHERE factory_id = :fid AND is_deleted = false"),
            {"fid": factory_id},
        ).fetchall()

        for user in users:
            user_id = user[0]
            role_raw = user[1]
            # Normalize role (handle enum uppercase values from PG)
            role = str(role_raw).lower() if role_raw else "viewer"
            conn.execute(
                sa.text(
                    "INSERT INTO user_site_roles (user_id, site_id, organization_id, role, is_primary) "
                    "VALUES (:uid, :sid, :oid, :role, true) "
                    "ON CONFLICT (user_id, site_id, role) DO NOTHING"
                ),
                {"uid": user_id, "sid": factory_id, "oid": org_id, "role": role},
            )


def downgrade():
    op.drop_table("user_site_roles")
    op.drop_index("ix_factories_organization_id", table_name="factories")
    op.drop_constraint("fk_factories_organization_id", "factories", type_="foreignkey")
    op.drop_column("factories", "site_code")
    op.drop_column("factories", "organization_id")
    op.drop_table("organizations")
