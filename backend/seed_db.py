"""
Seed database with demo admin user and factory.
Run after init_db.py to create an initial admin account.
Usage: python seed_db.py
"""
import os
import sys
import secrets

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.security import get_password_hash

db_url = os.environ.get("DATABASE_URL", "postgresql://leanpilot:leanpilot@localhost:5432/leanpilot")
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(db_url)

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@leanpilot.io")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
FACTORY_NAME = os.environ.get("FACTORY_NAME", "My Factory")

# Generate a random password if not provided
if not ADMIN_PASSWORD:
    ADMIN_PASSWORD = secrets.token_urlsafe(16)
    print(f"\n{'='*50}")
    print(f"  Generated admin password: {ADMIN_PASSWORD}")
    print(f"  Email: {ADMIN_EMAIL}")
    print(f"{'='*50}\n")

hashed = get_password_hash(ADMIN_PASSWORD)

with engine.connect() as conn:
    # Check if admin already exists
    result = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": ADMIN_EMAIL})
    if result.fetchone():
        print(f"Admin user {ADMIN_EMAIL} already exists, skipping seed.")
    else:
        # Create factory
        result = conn.execute(
            text("INSERT INTO factories (name, created_at, updated_at) VALUES (:name, NOW(), NOW()) RETURNING id"),
            {"name": FACTORY_NAME},
        )
        factory_id = result.fetchone()[0]

        # Create production lines
        for i, name in enumerate(["Line 1", "Line 2", "Line 3"], 1):
            conn.execute(
                text(
                    "INSERT INTO production_lines (factory_id, name, is_active, created_at, updated_at) "
                    "VALUES (:fid, :name, true, NOW(), NOW())"
                ),
                {"fid": factory_id, "name": name},
            )

        # Create admin user
        conn.execute(
            text(
                "INSERT INTO users (email, hashed_password, full_name, role, is_active, factory_id, language, created_at, updated_at) "
                "VALUES (:email, :pw, :name, 'ADMIN', true, :fid, 'en', NOW(), NOW())"
            ),
            {"email": ADMIN_EMAIL, "pw": hashed, "name": "Factory Admin", "fid": factory_id},
        )

        conn.commit()
        print(f"Seeded: factory '{FACTORY_NAME}' with 3 lines + admin user {ADMIN_EMAIL}")

engine.dispose()
