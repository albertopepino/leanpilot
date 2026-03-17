"""Create all base tables from SQLAlchemy models before running Alembic migrations.

This handles the case where alembic migrations expect existing tables (e.g., 001_gdpr
adds columns to 'users' but doesn't create it). We use create_all with checkfirst=True
so it's safe to run repeatedly.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, inspect
from app.models.base import Base
from app.models import *  # noqa: F401, F403

db_url = os.environ.get("DATABASE_URL", "postgresql://leanpilot:leanpilot@localhost:5432/leanpilot")
# Convert asyncpg URL to sync
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(db_url)

# Check if alembic has already been initialized (i.e., migrations manage the schema)
inspector = inspect(engine)
tables = inspector.get_table_names()

if "alembic_version" not in tables:
    # Fresh database — create all tables from models and stamp alembic to head
    Base.metadata.create_all(engine, checkfirst=True)
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    command.stamp(alembic_cfg, "head")
    print("DB initialized: tables created + alembic stamped to head")
else:
    # Alembic manages the schema. Use try/except to safely create any missing tables
    # without crashing on tables that already exist (e.g. created by migrations).
    try:
        Base.metadata.create_all(engine, checkfirst=True)
        print("DB schema sync complete (checkfirst=True)")
    except Exception as e:
        print(f"DB schema sync warning (non-fatal): {e}")
        # Tables already exist — that's fine, alembic manages them
    # Run alembic upgrade head here (with error handling) so the Dockerfile CMD
    # doesn't need to — prevents crash on DuplicateTable from migrations.
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    try:
        command.upgrade(alembic_cfg, "head")
        print("Alembic upgrade to head complete")
    except Exception as e:
        print(f"Alembic upgrade warning: {e}")
        # If migration fails because tables exist, stamp to head so it won't retry
        try:
            command.stamp(alembic_cfg, "head")
            print("Alembic stamped to head (tables already exist)")
        except Exception as e2:
            print(f"Alembic stamp warning: {e2}")
    print("DB already initialized, schema managed by alembic")


# ---------------------------------------------------------------------------
# Auto-create default factory + admin user if none exists
# ---------------------------------------------------------------------------
from sqlalchemy import text as sa_text
import bcrypt

admin_email = os.environ.get("ADMIN_EMAIL", "admin@leanpilot.io")
admin_password = os.environ.get("ADMIN_PASSWORD", "")
if not admin_password:
    import secrets as _secrets
    admin_password = _secrets.token_urlsafe(16)
    print(f"WARNING: ADMIN_PASSWORD not set. Generated random password: {admin_password}")
    print("Save this password — it will not be shown again.")
factory_name = os.environ.get("FACTORY_NAME", "My Factory")

with engine.connect() as conn:
    # Ensure a default factory exists
    result = conn.execute(sa_text("SELECT id FROM factories LIMIT 1"))
    factory_row = result.first()
    if factory_row is None:
        # Detect the correct enum label for subscription_tier
        # (PG enum may store uppercase STARTER or lowercase starter depending on creation)
        tier_result = conn.execute(sa_text(
            "SELECT enumlabel FROM pg_enum "
            "WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscriptiontier') "
            "ORDER BY enumsortorder LIMIT 1"
        ))
        tier_row = tier_result.first()
        tier_value = tier_row[0] if tier_row else None

        if tier_value:
            conn.execute(sa_text(
                "INSERT INTO factories (name, location, country, sector, subscription_tier, ai_enabled, "
                "created_at, updated_at) "
                "VALUES (:name, 'Default', 'IT', 'manufacturing', :tier, false, NOW(), NOW())"
            ), {"name": factory_name, "tier": tier_value})
        else:
            # No enum type found — skip subscription_tier, let it be NULL
            conn.execute(sa_text(
                "INSERT INTO factories (name, location, country, sector, ai_enabled, "
                "created_at, updated_at) "
                "VALUES (:name, 'Default', 'IT', 'manufacturing', false, NOW(), NOW())"
            ), {"name": factory_name})
        conn.commit()
        result = conn.execute(sa_text("SELECT id FROM factories LIMIT 1"))
        factory_row = result.first()
        print(f"Default factory created: {factory_name} (id={factory_row[0]})")
    factory_id = factory_row[0]

    # Ensure admin user exists — detect correct enum label for role
    role_result = conn.execute(sa_text(
        "SELECT enumlabel FROM pg_enum "
        "WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole') "
        "AND enumlabel IN ('admin', 'ADMIN') LIMIT 1"
    ))
    role_row = role_result.first()
    admin_role = role_row[0] if role_row else "admin"

    result = conn.execute(sa_text(
        "SELECT COUNT(*) FROM users WHERE role = :role"
    ), {"role": admin_role})
    admin_count = result.scalar()
    if admin_count == 0:
        hashed = bcrypt.hashpw(admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        conn.execute(sa_text(
            "INSERT INTO users (email, hashed_password, full_name, role, is_active, language, "
            "ai_consent, marketing_consent, is_deleted, failed_login_attempts, factory_id) "
            "VALUES (:email, :hash, :name, :role, true, 'en', false, false, false, 0, :fid)"
        ), {"email": admin_email, "hash": hashed, "name": "Admin", "role": admin_role, "fid": factory_id})
        conn.commit()
        print(f"Admin user created: {admin_email} (factory_id={factory_id}, role={admin_role})")
    else:
        # Ensure existing admin has a factory_id
        conn.execute(sa_text(
            "UPDATE users SET factory_id = :fid WHERE role = :role AND factory_id IS NULL"
        ), {"fid": factory_id, "role": admin_role})
        conn.commit()
        print(f"Admin user already exists ({admin_count} found), ensured factory assignment")

engine.dispose()
