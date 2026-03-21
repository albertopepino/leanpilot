"""
Seed script: Organizations, Factories, Users, and RBAC roles.

Creates a realistic multi-tenant demo setup:
  - 1 Platform superadmin (owner)
  - 2 Organizations (consulting clients)
  - 3 Factories across the 2 orgs
  - Users per factory covering all roles
  - Corporate users with org-level access
  - Production lines + shifts per factory

Usage:
    python seed_organizations.py                  # Seed (skip if exists)
    python seed_organizations.py --wipe           # Wipe seed data and re-seed
    python seed_organizations.py --clean          # Wipe seed data only
    python seed_organizations.py --password XYZ   # Set all demo passwords to XYZ

All demo users get the same password (default: LeanDemo2026!)
Superadmin gets a separate password (default: Admin123! or --password value)
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.security import get_password_hash

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
db_url = os.environ.get("DATABASE_URL", "postgresql://leanpilot:leanpilot@localhost:5432/leanpilot")
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(db_url)

DEFAULT_DEMO_PASSWORD = "LeanDemo2026!"
DEFAULT_ADMIN_PASSWORD = "Admin123!"

# ---------------------------------------------------------------------------
# Enum helper — detect PostgreSQL enum case
# ---------------------------------------------------------------------------
_ENUM_CASE: str | None = None


def E(value: str) -> str:
    """Return enum value matching the PostgreSQL enum type case."""
    global _ENUM_CASE
    if not value:
        return value
    if _ENUM_CASE is None:
        try:
            with engine.connect() as conn:
                result = conn.execute(text(
                    "SELECT enumlabel FROM pg_enum "
                    "WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole') "
                    "LIMIT 1"
                ))
                row = result.fetchone()
                _ENUM_CASE = "upper" if (row and row[0] == row[0].upper()) else "lower"
        except Exception:
            _ENUM_CASE = "lower"
    return value.upper() if _ENUM_CASE == "upper" else value.lower()


# ---------------------------------------------------------------------------
# Data definitions
# ---------------------------------------------------------------------------

ORGANIZATIONS = [
    {
        "name": "Grassi Cosmetics Group",
        "slug": "grassi-cosmetics",
        "subscription_tier": "enterprise",
        "max_sites": 5,
        "max_users": 50,
    },
    {
        "name": "Balkan Steel Industries",
        "slug": "balkan-steel",
        "subscription_tier": "professional",
        "max_sites": 3,
        "max_users": 30,
    },
]

# Factories keyed by org slug
FACTORIES = {
    "grassi-cosmetics": [
        {
            "name": "Milano Packaging Plant",
            "site_code": "MIL",
            "location": "Milan, Italy",
            "country": "IT",
            "sector": "cosmetics",
            "employee_count": 120,
            "timezone": "Europe/Rome",
            "lines": [
                {"name": "Filling Line A", "product_type": "liquid filling", "target_oee": 85.0, "target_cycle_time_seconds": 12.0},
                {"name": "Packaging Line B", "product_type": "box packaging", "target_oee": 80.0, "target_cycle_time_seconds": 8.0},
                {"name": "Labeling Line C", "product_type": "label application", "target_oee": 90.0, "target_cycle_time_seconds": 5.0},
            ],
        },
        {
            "name": "Parma Quality Lab",
            "site_code": "PRM",
            "location": "Parma, Italy",
            "country": "IT",
            "sector": "cosmetics",
            "employee_count": 45,
            "timezone": "Europe/Rome",
            "lines": [
                {"name": "Testing Line 1", "product_type": "QC testing", "target_oee": 75.0, "target_cycle_time_seconds": 30.0},
                {"name": "R&D Pilot Line", "product_type": "pilot batches", "target_oee": 70.0, "target_cycle_time_seconds": 60.0},
            ],
        },
    ],
    "balkan-steel": [
        {
            "name": "Belgrade Steel Works",
            "site_code": "BGD",
            "location": "Belgrade, Serbia",
            "country": "RS",
            "sector": "steel",
            "employee_count": 250,
            "timezone": "Europe/Belgrade",
            "lines": [
                {"name": "Hot Rolling Mill", "product_type": "hot rolled steel", "target_oee": 82.0, "target_cycle_time_seconds": 45.0},
                {"name": "Cold Rolling Mill", "product_type": "cold rolled steel", "target_oee": 78.0, "target_cycle_time_seconds": 55.0},
                {"name": "Galvanizing Line", "product_type": "galvanized steel", "target_oee": 85.0, "target_cycle_time_seconds": 40.0},
                {"name": "Cut-to-Length Line", "product_type": "sheet cutting", "target_oee": 88.0, "target_cycle_time_seconds": 20.0},
            ],
        },
    ],
}

SHIFTS = [
    {"name": "Morning", "start_hour": 6, "end_hour": 14, "planned_minutes": 480},
    {"name": "Afternoon", "start_hour": 14, "end_hour": 22, "planned_minutes": 480},
    {"name": "Night", "start_hour": 22, "end_hour": 6, "planned_minutes": 480},
]

# Superadmin (platform owner)
SUPERADMIN = {
    "email": "admin@leanpilot.io",
    "full_name": "LeanPilot Admin",
    "language": "en",
}

# Corporate users (org-level, site_id=NULL in user_site_roles)
CORPORATE_USERS = {
    "grassi-cosmetics": [
        {"email": "m.grassi@grassi-cosmetics.com", "full_name": "Marco Grassi", "role": "admin", "language": "it"},
        {"email": "l.rossi@grassi-cosmetics.com", "full_name": "Laura Rossi", "role": "plant_manager", "language": "it"},
    ],
    "balkan-steel": [
        {"email": "d.jovanovic@balkansteel.rs", "full_name": "Dragan Jovanović", "role": "admin", "language": "sr"},
        {"email": "m.petrovic@balkansteel.rs", "full_name": "Milica Petrović", "role": "plant_manager", "language": "sr"},
    ],
}

# Site users — one per role per factory (keyed by site_code)
SITE_USERS = {
    "MIL": [
        {"email": "g.bianchi@grassi-cosmetics.com", "full_name": "Giovanni Bianchi", "role": "admin", "language": "it"},
        {"email": "f.ferrari@grassi-cosmetics.com", "full_name": "Francesca Ferrari", "role": "production_manager", "language": "it"},
        {"email": "a.romano@grassi-cosmetics.com", "full_name": "Alessandro Romano", "role": "quality_manager", "language": "it"},
        {"email": "s.colombo@grassi-cosmetics.com", "full_name": "Sara Colombo", "role": "quality_supervisor", "language": "it"},
        {"email": "l.ricci@grassi-cosmetics.com", "full_name": "Luca Ricci", "role": "line_supervisor", "language": "it"},
        {"email": "e.moretti@grassi-cosmetics.com", "full_name": "Elena Moretti", "role": "quality_inspector", "language": "it"},
        {"email": "m.conti@grassi-cosmetics.com", "full_name": "Matteo Conti", "role": "maintenance", "language": "it"},
        {"email": "c.gallo@grassi-cosmetics.com", "full_name": "Chiara Gallo", "role": "operator", "language": "it"},
        {"email": "p.marino@grassi-cosmetics.com", "full_name": "Paolo Marino", "role": "viewer", "language": "it"},
    ],
    "PRM": [
        {"email": "r.esposito@grassi-cosmetics.com", "full_name": "Roberto Esposito", "role": "admin", "language": "it"},
        {"email": "v.greco@grassi-cosmetics.com", "full_name": "Valentina Greco", "role": "quality_manager", "language": "it"},
        {"email": "d.bruno@grassi-cosmetics.com", "full_name": "Davide Bruno", "role": "quality_inspector", "language": "it"},
        {"email": "a.costa@grassi-cosmetics.com", "full_name": "Anna Costa", "role": "operator", "language": "it"},
    ],
    "BGD": [
        {"email": "s.nikolic@balkansteel.rs", "full_name": "Stefan Nikolić", "role": "admin", "language": "sr"},
        {"email": "j.todorovic@balkansteel.rs", "full_name": "Jelena Todorović", "role": "plant_manager", "language": "sr"},
        {"email": "n.djordjevic@balkansteel.rs", "full_name": "Nikola Đorđević", "role": "production_manager", "language": "sr"},
        {"email": "a.ivanovic@balkansteel.rs", "full_name": "Ana Ivanović", "role": "quality_manager", "language": "sr"},
        {"email": "m.stojanovic@balkansteel.rs", "full_name": "Marko Stojanović", "role": "quality_supervisor", "language": "sr"},
        {"email": "i.popovic@balkansteel.rs", "full_name": "Ivan Popović", "role": "line_supervisor", "language": "sr"},
        {"email": "t.markovic@balkansteel.rs", "full_name": "Tamara Marković", "role": "quality_inspector", "language": "sr"},
        {"email": "b.lazarevic@balkansteel.rs", "full_name": "Bojan Lazarević", "role": "maintenance", "language": "sr"},
        {"email": "k.milosevic@balkansteel.rs", "full_name": "Katarina Milošević", "role": "operator", "language": "sr"},
        {"email": "v.pavlovic@balkansteel.rs", "full_name": "Vladimir Pavlović", "role": "viewer", "language": "sr"},
    ],
}


# ---------------------------------------------------------------------------
# Wipe
# ---------------------------------------------------------------------------
def wipe_seed_data(conn):
    """Remove all seed data created by this script."""
    print("[WIPE] Removing seeded organizations, factories, and users...")

    # Collect org IDs
    org_ids = []
    for org in ORGANIZATIONS:
        row = conn.execute(
            text("SELECT id FROM organizations WHERE slug = :slug"),
            {"slug": org["slug"]},
        ).fetchone()
        if row:
            org_ids.append(row[0])

    if not org_ids:
        # Also remove superadmin
        conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": SUPERADMIN["email"]})
        conn.commit()
        print("[WIPE] No seeded organizations found. Cleaned up superadmin only.")
        return

    # Collect factory IDs
    factory_ids = []
    for oid in org_ids:
        rows = conn.execute(
            text("SELECT id FROM factories WHERE organization_id = :oid"), {"oid": oid}
        ).fetchall()
        factory_ids.extend([r[0] for r in rows])

    # Collect user IDs from site_roles + corporate users + superadmin
    all_emails = [SUPERADMIN["email"]]
    for users in CORPORATE_USERS.values():
        all_emails.extend(u["email"] for u in users)
    for users in SITE_USERS.values():
        all_emails.extend(u["email"] for u in users)

    user_ids = []
    for email in all_emails:
        row = conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).fetchone()
        if row:
            user_ids.append(row[0])

    # Delete in dependency order
    if user_ids:
        conn.execute(text(f"DELETE FROM user_site_roles WHERE user_id = ANY(:uids)"), {"uids": user_ids})
        conn.execute(text(f"DELETE FROM users WHERE id = ANY(:uids)"), {"uids": user_ids})

    if factory_ids:
        # Delete shifts → production_lines → company_settings → factories
        for fid in factory_ids:
            conn.execute(text(
                "DELETE FROM shifts WHERE production_line_id IN "
                "(SELECT id FROM production_lines WHERE factory_id = :fid)"
            ), {"fid": fid})
            conn.execute(text("DELETE FROM production_lines WHERE factory_id = :fid"), {"fid": fid})
            conn.execute(text("DELETE FROM company_settings WHERE factory_id = :fid"), {"fid": fid})
        conn.execute(text(f"DELETE FROM factories WHERE id = ANY(:fids)"), {"fids": factory_ids})

    for oid in org_ids:
        conn.execute(text("DELETE FROM organizations WHERE id = :oid"), {"oid": oid})

    conn.commit()
    print(f"[WIPE] Removed {len(org_ids)} orgs, {len(factory_ids)} factories, {len(user_ids)} users.")


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
def seed(demo_password: str, admin_password: str):
    demo_hash = get_password_hash(demo_password)
    admin_hash = get_password_hash(admin_password)

    with engine.connect() as conn:
        # Check if already seeded
        existing = conn.execute(
            text("SELECT id FROM organizations WHERE slug = :s"),
            {"s": ORGANIZATIONS[0]["slug"]},
        ).fetchone()
        if existing:
            print("[SEED] Organizations already exist. Use --wipe to re-seed.")
            return

        # ------------------------------------------------------------------
        # 1. Superadmin
        # ------------------------------------------------------------------
        row = conn.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": SUPERADMIN["email"]}
        ).fetchone()
        if row:
            superadmin_id = row[0]
            # Update to ensure is_superadmin = true
            conn.execute(text(
                "UPDATE users SET is_superadmin = true, hashed_password = :pw, is_active = true, "
                "is_deleted = false WHERE id = :uid"
            ), {"pw": admin_hash, "uid": superadmin_id})
            print(f"  [OK] Superadmin updated: {SUPERADMIN['email']}")
        else:
            row = conn.execute(text(
                "INSERT INTO users (email, hashed_password, full_name, role, is_active, is_superadmin, language, created_at, updated_at) "
                "VALUES (:email, :pw, :name, :role, true, true, :lang, NOW(), NOW()) RETURNING id"
            ), {
                "email": SUPERADMIN["email"],
                "pw": admin_hash,
                "name": SUPERADMIN["full_name"],
                "role": E("admin"),
                "lang": SUPERADMIN["language"],
            }).fetchone()
            superadmin_id = row[0]
            print(f"  [OK] Superadmin created: {SUPERADMIN['email']}")

        # ------------------------------------------------------------------
        # 2. Organizations
        # ------------------------------------------------------------------
        org_map = {}  # slug -> id
        for org in ORGANIZATIONS:
            row = conn.execute(text(
                "INSERT INTO organizations (name, slug, subscription_tier, max_sites, max_users, is_active) "
                "VALUES (:name, :slug, :tier, :max_sites, :max_users, true) RETURNING id"
            ), {
                "name": org["name"],
                "slug": org["slug"],
                "tier": org["subscription_tier"],
                "max_sites": org["max_sites"],
                "max_users": org["max_users"],
            }).fetchone()
            org_map[org["slug"]] = row[0]
            print(f"  [OK] Org: {org['name']} (id={row[0]})")

        # ------------------------------------------------------------------
        # 3. Factories + Production Lines + Shifts
        # ------------------------------------------------------------------
        factory_map = {}  # site_code -> (factory_id, org_id)
        for org_slug, factories in FACTORIES.items():
            org_id = org_map[org_slug]
            for fdata in factories:
                row = conn.execute(text(
                    "INSERT INTO factories (name, site_code, location, country, sector, employee_count, "
                    "timezone, organization_id, ai_enabled, created_at, updated_at) "
                    "VALUES (:name, :code, :loc, :country, :sector, :emp, :tz, :oid, true, NOW(), NOW()) "
                    "RETURNING id"
                ), {
                    "name": fdata["name"],
                    "code": fdata["site_code"],
                    "loc": fdata["location"],
                    "country": fdata["country"],
                    "sector": fdata["sector"],
                    "emp": fdata["employee_count"],
                    "tz": fdata["timezone"],
                    "oid": org_id,
                }).fetchone()
                fid = row[0]
                factory_map[fdata["site_code"]] = (fid, org_id)
                print(f"  [OK] Factory: {fdata['name']} [{fdata['site_code']}] (id={fid})")

                # Production lines
                for ldata in fdata["lines"]:
                    line_row = conn.execute(text(
                        "INSERT INTO production_lines (factory_id, name, product_type, target_oee, "
                        "target_cycle_time_seconds, is_active, created_at, updated_at) "
                        "VALUES (:fid, :name, :ptype, :oee, :cycle, true, NOW(), NOW()) RETURNING id"
                    ), {
                        "fid": fid,
                        "name": ldata["name"],
                        "ptype": ldata["product_type"],
                        "oee": ldata["target_oee"],
                        "cycle": ldata["target_cycle_time_seconds"],
                    }).fetchone()
                    line_id = line_row[0]

                    # Shifts for each line
                    for shift in SHIFTS:
                        conn.execute(text(
                            "INSERT INTO shifts (production_line_id, name, start_hour, end_hour, "
                            "planned_minutes, created_at, updated_at) "
                            "VALUES (:lid, :name, :start, :end, :mins, NOW(), NOW())"
                        ), {
                            "lid": line_id,
                            "name": shift["name"],
                            "start": shift["start_hour"],
                            "end": shift["end_hour"],
                            "mins": shift["planned_minutes"],
                        })
                    print(f"    Line: {ldata['name']} + 3 shifts")

                # Company settings
                conn.execute(text(
                    "INSERT INTO company_settings (factory_id, company_display_name, created_at, updated_at) "
                    "VALUES (:fid, :name, NOW(), NOW())"
                ), {"fid": fid, "name": fdata["name"]})

        # ------------------------------------------------------------------
        # 4. Corporate users (org-level roles, no site_id)
        # ------------------------------------------------------------------
        print("\n--- Corporate Users ---")
        for org_slug, users in CORPORATE_USERS.items():
            org_id = org_map[org_slug]
            # Assign to first factory of this org for legacy factory_id
            first_factory_id = None
            for code, (fid, oid) in factory_map.items():
                if oid == org_id:
                    first_factory_id = fid
                    break

            for udata in users:
                row = conn.execute(text(
                    "INSERT INTO users (email, hashed_password, full_name, role, is_active, factory_id, language, created_at, updated_at) "
                    "VALUES (:email, :pw, :name, :role, true, :fid, :lang, NOW(), NOW()) RETURNING id"
                ), {
                    "email": udata["email"],
                    "pw": demo_hash,
                    "name": udata["full_name"],
                    "role": E(udata["role"]),
                    "fid": first_factory_id,
                    "lang": udata["language"],
                }).fetchone()
                uid = row[0]

                # Org-level site role (site_id = NULL)
                conn.execute(text(
                    "INSERT INTO user_site_roles (user_id, site_id, organization_id, role, is_primary, created_at) "
                    "VALUES (:uid, NULL, :oid, :role, true, NOW())"
                ), {"uid": uid, "oid": org_id, "role": udata["role"]})

                print(f"  [OK] {udata['full_name']} <{udata['email']}> — {udata['role']} @ {org_slug} (corporate)")

        # ------------------------------------------------------------------
        # 5. Site users (per-factory roles)
        # ------------------------------------------------------------------
        print("\n--- Site Users ---")
        for site_code, users in SITE_USERS.items():
            fid, org_id = factory_map[site_code]
            for udata in users:
                row = conn.execute(text(
                    "INSERT INTO users (email, hashed_password, full_name, role, is_active, factory_id, language, created_at, updated_at) "
                    "VALUES (:email, :pw, :name, :role, true, :fid, :lang, NOW(), NOW()) RETURNING id"
                ), {
                    "email": udata["email"],
                    "pw": demo_hash,
                    "name": udata["full_name"],
                    "role": E(udata["role"]),
                    "fid": fid,
                    "lang": udata["language"],
                }).fetchone()
                uid = row[0]

                # Site-level role
                is_primary = udata["role"] == "admin"
                conn.execute(text(
                    "INSERT INTO user_site_roles (user_id, site_id, organization_id, role, is_primary, created_at) "
                    "VALUES (:uid, :sid, :oid, :role, :primary, NOW())"
                ), {"uid": uid, "sid": fid, "oid": org_id, "role": udata["role"], "primary": is_primary})

                print(f"  [OK] {udata['full_name']} <{udata['email']}> — {udata['role']} @ {site_code}")

        conn.commit()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total_users = 1  # superadmin
    for users in CORPORATE_USERS.values():
        total_users += len(users)
    for users in SITE_USERS.values():
        total_users += len(users)

    total_factories = sum(len(f) for f in FACTORIES.values())

    print(f"\n{'='*60}")
    print(f"  SEED COMPLETE")
    print(f"  Organizations:  {len(ORGANIZATIONS)}")
    print(f"  Factories:      {total_factories}")
    print(f"  Users:          {total_users}")
    print(f"{'='*60}")
    print(f"\n  Superadmin:  {SUPERADMIN['email']} / {admin_password}")
    print(f"  Demo users:  (all) / {demo_password}")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed organizations, factories, and users")
    parser.add_argument("--wipe", action="store_true", help="Wipe seed data and re-seed")
    parser.add_argument("--clean", action="store_true", help="Wipe seed data only (no re-seed)")
    parser.add_argument("--password", type=str, default=DEFAULT_DEMO_PASSWORD, help="Demo user password")
    parser.add_argument("--admin-password", type=str, default=DEFAULT_ADMIN_PASSWORD, help="Superadmin password")
    args = parser.parse_args()

    if args.wipe or args.clean:
        with engine.connect() as conn:
            wipe_seed_data(conn)
        if args.clean:
            print("Done (clean only).")
            sys.exit(0)

    seed(args.password, args.admin_password)
    engine.dispose()
