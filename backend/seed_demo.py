"""
Comprehensive Demo Data Seed Script for LeanPilot.
Populates ALL features with realistic lean manufacturing demo data.

Usage:
    python seed_demo.py          # Seed demo data
    python seed_demo.py --wipe   # Wipe all demo data and re-seed
    python seed_demo.py --clean  # Wipe demo data only (no re-seed)

Demo login: demo / demo
"""
import os
import sys
import json
import random
from datetime import datetime, timedelta, timezone, date, time

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text
from app.core.security import get_password_hash

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
db_url = os.environ.get("DATABASE_URL", "postgresql://leanpilot:leanpilot@localhost:5432/leanpilot")
db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(db_url)

DEMO_EMAIL = "demo"
DEMO_PASSWORD = "demo"
DEMO_FACTORY_NAME = "LeanPilot Demo Factory"
DEMO_TAG = "DEMO_DATA"  # Tag to identify demo records for wiping

NOW = datetime.now(timezone.utc)
TODAY = date.today()

random.seed(42)  # Reproducible demo data


# ---------------------------------------------------------------------------
# Enum helper — store enum values as UPPERCASE (matching PostgreSQL enum types)
# ---------------------------------------------------------------------------
def E(value: str) -> str:
    """Return enum value as UPPERCASE to match PostgreSQL enum type definitions."""
    if not value:
        return value
    return value.upper()


# ---------------------------------------------------------------------------
# Wipe
# ---------------------------------------------------------------------------
def wipe_demo_data(conn):
    """Remove all demo data. Order matters due to FK constraints."""
    print("[WIPE] Removing demo data...")

    # Find demo factory
    result = conn.execute(text("SELECT id FROM factories WHERE name = :name"), {"name": DEMO_FACTORY_NAME})
    row = result.fetchone()
    if not row:
        print("[WIPE] No demo factory found. Nothing to wipe.")
        return
    fid = row[0]

    # Delete in reverse dependency order
    # AI
    conn.execute(text("""
        DELETE FROM ai_messages WHERE conversation_id IN
        (SELECT id FROM ai_conversations WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM ai_conversations WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM ai_kaizen_suggestions WHERE factory_id = :fid"), {"fid": fid})

    # CILT
    conn.execute(text("""
        DELETE FROM cilt_checks WHERE execution_id IN
        (SELECT e.id FROM cilt_executions e JOIN cilt_standards s ON e.standard_id = s.id WHERE s.factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("""
        DELETE FROM cilt_executions WHERE standard_id IN
        (SELECT id FROM cilt_standards WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("""
        DELETE FROM cilt_items WHERE standard_id IN
        (SELECT id FROM cilt_standards WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM cilt_standards WHERE factory_id = :fid"), {"fid": fid})

    # TPM
    conn.execute(text("""
        DELETE FROM tpm_maintenance_records WHERE equipment_id IN
        (SELECT id FROM tpm_equipment WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM tpm_equipment WHERE factory_id = :fid"), {"fid": fid})

    # Andon & Hourly
    conn.execute(text("DELETE FROM andon_events WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM hourly_production WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})

    # Advanced Lean
    conn.execute(text("""
        DELETE FROM gemba_observations WHERE walk_id IN
        (SELECT id FROM gemba_walks WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM gemba_walks WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM a3_reports WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM vsm_steps WHERE vsm_map_id IN
        (SELECT id FROM vsm_maps WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM vsm_maps WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM six_s_audit_items WHERE audit_id IN
        (SELECT id FROM six_s_audits WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM six_s_audits WHERE factory_id = :fid"), {"fid": fid})

    # Lean core
    conn.execute(text("""
        DELETE FROM smed_steps WHERE record_id IN
        (SELECT id FROM smed_records WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM smed_records WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM kaizen_items WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM ishikawa_causes WHERE analysis_id IN
        (SELECT id FROM ishikawa_analyses WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM ishikawa_analyses WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM five_why_steps WHERE analysis_id IN
        (SELECT id FROM five_why_analyses WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM five_why_analyses WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM lean_assessments WHERE factory_id = :fid"), {"fid": fid})

    # OEE
    conn.execute(text("""
        DELETE FROM oee_records WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})

    # QC chain: CAPA -> NCR -> QCCheckResults -> QCRecords -> QCTemplateItems -> QCTemplates
    conn.execute(text("DELETE FROM capa_actions WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM non_conformance_reports WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM qc_check_results WHERE qc_record_id IN
        (SELECT id FROM qc_records WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM qc_records WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("""
        DELETE FROM qc_template_items WHERE template_id IN
        (SELECT id FROM qc_templates WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM qc_templates WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM qc_policy_documents WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM defect_catalog WHERE factory_id = :fid"), {"fid": fid})

    # Production
    conn.execute(text("""
        DELETE FROM scrap_records WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("""
        DELETE FROM downtime_events WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("""
        DELETE FROM production_records WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM production_orders WHERE factory_id = :fid"), {"fid": fid})

    # Manufacturing
    conn.execute(text("""
        DELETE FROM bom_components WHERE bom_id IN
        (SELECT id FROM bom_headers WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM bom_headers WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM products WHERE factory_id = :fid"), {"fid": fid})
    conn.execute(text("DELETE FROM work_centers WHERE factory_id = :fid"), {"fid": fid})

    # Audit logs for demo factory
    conn.execute(text("DELETE FROM audit_logs WHERE factory_id = :fid"), {"fid": fid})

    # Company settings
    conn.execute(text("DELETE FROM company_settings WHERE factory_id = :fid"), {"fid": fid})

    # Shifts -> Production lines
    conn.execute(text("""
        DELETE FROM shifts WHERE production_line_id IN
        (SELECT id FROM production_lines WHERE factory_id = :fid)
    """), {"fid": fid})
    conn.execute(text("DELETE FROM production_lines WHERE factory_id = :fid"), {"fid": fid})

    # Users in demo factory
    conn.execute(text("DELETE FROM users WHERE factory_id = :fid"), {"fid": fid})

    # Factory itself
    conn.execute(text("DELETE FROM factories WHERE id = :fid"), {"fid": fid})

    conn.commit()
    print("[WIPE] Demo data removed successfully.")


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
def seed_demo_data(conn):
    """Create comprehensive demo data for all LeanPilot features."""
    print("[SEED] Creating demo data...")

    # Check if demo factory already exists
    result = conn.execute(text("SELECT id FROM factories WHERE name = :name"), {"name": DEMO_FACTORY_NAME})
    if result.fetchone():
        print("[SEED] Demo factory already exists. Use --wipe to reset.")
        return

    # -----------------------------------------------------------------------
    # 1. Factory
    # -----------------------------------------------------------------------
    result = conn.execute(text("""
        INSERT INTO factories (name, location, country, sector, employee_count, subscription_tier, ai_enabled, created_at, updated_at)
        VALUES (:name, 'Milan, Italy', 'IT', 'Automotive Parts', 120, :tier, true, :now, :now)
        RETURNING id
    """), {"name": DEMO_FACTORY_NAME, "tier": E("professional"), "now": NOW})
    fid = result.fetchone()[0]
    print(f"  Factory: {DEMO_FACTORY_NAME} (id={fid})")

    # -----------------------------------------------------------------------
    # 2. Production Lines + Shifts
    # -----------------------------------------------------------------------
    lines_data = [
        ("Assembly Line A", "Engine Components", 85.0, 45),
        ("Assembly Line B", "Transmission Parts", 80.0, 60),
        ("CNC Machining", "Precision Parts", 90.0, 30),
        ("Welding Cell 1", "Chassis Frames", 75.0, 90),
        ("Paint & Coating", "Surface Finish", 82.0, 120),
    ]
    line_ids = []
    for name, product_type, target_oee, cycle_time in lines_data:
        r = conn.execute(text("""
            INSERT INTO production_lines (factory_id, name, product_type, target_oee, target_cycle_time_seconds, is_active, created_at, updated_at)
            VALUES (:fid, :name, :pt, :oee, :ct, true, :now, :now) RETURNING id
        """), {"fid": fid, "name": name, "pt": product_type, "oee": target_oee, "ct": cycle_time, "now": NOW})
        line_ids.append(r.fetchone()[0])
    print(f"  Production Lines: {len(line_ids)}")

    # Shifts for each line
    shift_ids = {}
    for lid in line_ids:
        shift_ids[lid] = []
        for sname, sh, eh, pm in [("Morning", 6, 14, 480), ("Afternoon", 14, 22, 480), ("Night", 22, 6, 480)]:
            r = conn.execute(text("""
                INSERT INTO shifts (production_line_id, name, start_hour, end_hour, planned_minutes, created_at, updated_at)
                VALUES (:lid, :name, :sh, :eh, :pm, :now, :now) RETURNING id
            """), {"lid": lid, "name": sname, "sh": sh, "eh": eh, "pm": pm, "now": NOW})
            shift_ids[lid].append(r.fetchone()[0])
    print(f"  Shifts: {sum(len(v) for v in shift_ids.values())}")

    # -----------------------------------------------------------------------
    # 3. Users (Demo + team)
    # -----------------------------------------------------------------------
    demo_pw = get_password_hash(DEMO_PASSWORD)

    # Demo user (admin access for full demo)
    r = conn.execute(text("""
        INSERT INTO users (email, hashed_password, full_name, role, is_active, factory_id, language, created_at, updated_at,
                           privacy_policy_accepted_at, terms_accepted_at, consent_version)
        VALUES (:email, :pw, 'Demo User', :role, true, :fid, 'en', :now, :now, :now, :now, '1.0')
        RETURNING id
    """), {"email": DEMO_EMAIL, "pw": demo_pw, "role": E("admin"), "fid": fid, "now": NOW})
    demo_user_id = r.fetchone()[0]
    print(f"  Demo user: {DEMO_EMAIL} / {DEMO_PASSWORD} (id={demo_user_id})")

    # Additional team members
    team = [
        ("mario.rossi@demo.leanpilot.io", "Mario Rossi", "plant_manager"),
        ("giulia.bianchi@demo.leanpilot.io", "Giulia Bianchi", "line_supervisor"),
        ("luca.ferrari@demo.leanpilot.io", "Luca Ferrari", "operator"),
        ("anna.conti@demo.leanpilot.io", "Anna Conti", "operator"),
        ("marco.ricci@demo.leanpilot.io", "Marco Ricci", "viewer"),
    ]
    user_ids = [demo_user_id]
    for email, name, role in team:
        r = conn.execute(text("""
            INSERT INTO users (email, hashed_password, full_name, role, is_active, factory_id, language, created_at, updated_at,
                               privacy_policy_accepted_at, terms_accepted_at, consent_version)
            VALUES (:email, :pw, :name, :role, true, :fid, 'it', :now, :now, :now, :now, '1.0')
            RETURNING id
        """), {"email": email, "pw": demo_pw, "name": name, "role": E(role), "fid": fid, "now": NOW})
        user_ids.append(r.fetchone()[0])
    print(f"  Users: {len(user_ids)}")

    # -----------------------------------------------------------------------
    # 4. Work Centers
    # -----------------------------------------------------------------------
    wc_data = [
        (line_ids[0], "WC-ASM-01", "Press Station", "Hydraulic Press", 120),
        (line_ids[0], "WC-ASM-02", "Assembly Station", "Manual Assembly", 90),
        (line_ids[1], "WC-TRN-01", "Gear Cutting", "CNC Gear Hobber", 60),
        (line_ids[2], "WC-CNC-01", "CNC Lathe", "5-Axis CNC", 45),
        (line_ids[2], "WC-CNC-02", "CNC Mill", "3-Axis Mill", 55),
        (line_ids[3], "WC-WLD-01", "Robot Welder", "MIG Robot", 30),
        (line_ids[4], "WC-PNT-01", "Paint Booth", "Electrostatic Spray", 20),
    ]
    wc_ids = []
    for plid, code, name, mtype, capacity in wc_data:
        r = conn.execute(text("""
            INSERT INTO work_centers (factory_id, production_line_id, name, description, machine_type, capacity_units_per_hour, is_active, created_at, updated_at)
            VALUES (:fid, :plid, :name, :desc, :mt, :cap, true, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "name": name, "desc": f"{name} - {code}", "mt": mtype, "cap": capacity, "now": NOW})
        wc_ids.append(r.fetchone()[0])
    print(f"  Work Centers: {len(wc_ids)}")

    # -----------------------------------------------------------------------
    # 5. Products + BOMs
    # -----------------------------------------------------------------------
    products_data = [
        ("ENG-001", "Engine Block V6", "Primary engine block casting", "pcs", "Engine Components"),
        ("ENG-002", "Cylinder Head", "Aluminum cylinder head", "pcs", "Engine Components"),
        ("TRN-001", "Gearbox Housing", "5-speed gearbox housing", "pcs", "Transmission"),
        ("TRN-002", "Drive Shaft", "Hardened steel drive shaft", "pcs", "Transmission"),
        ("CHS-001", "Front Subframe", "Welded subframe assembly", "pcs", "Chassis"),
        ("CHS-002", "Rear Axle Beam", "Stamped and welded beam", "pcs", "Chassis"),
        ("PNT-001", "Primer Coat Kit", "Anti-corrosion primer set", "kit", "Coatings"),
        ("PNT-002", "Clear Coat Kit", "UV-resistant clear coat", "kit", "Coatings"),
    ]
    prod_ids = []
    for code, name, desc, uom, family in products_data:
        r = conn.execute(text("""
            INSERT INTO products (factory_id, code, name, description, unit_of_measure, product_family, is_active, created_at, updated_at)
            VALUES (:fid, :code, :name, :desc, :uom, :fam, true, :now, :now) RETURNING id
        """), {"fid": fid, "code": code, "name": name, "desc": desc, "uom": uom, "fam": family, "now": NOW})
        prod_ids.append(r.fetchone()[0])
    print(f"  Products: {len(prod_ids)}")

    # BOMs
    bom_ids = []
    bom_components = [
        # Engine Block BOM
        [("STL-001", "Cast Iron Block", 1, "pcs", True), ("BRG-001", "Main Bearings Set", 5, "pcs", True),
         ("GSK-001", "Head Gasket", 1, "pcs", True), ("BLT-001", "Head Bolts M12", 16, "pcs", False)],
        # Cylinder Head BOM
        [("ALU-001", "Aluminum Billet", 8.5, "kg", True), ("VLV-001", "Intake Valve", 4, "pcs", True),
         ("VLV-002", "Exhaust Valve", 4, "pcs", True), ("SPR-001", "Valve Spring", 8, "pcs", False)],
        # Gearbox Housing
        [("ALU-002", "Die-Cast Housing", 1, "pcs", True), ("BRG-002", "Shaft Bearings", 6, "pcs", True),
         ("SEL-001", "Oil Seal Set", 1, "kit", True)],
        # Drive Shaft
        [("STL-002", "Hardened Steel Rod", 1.2, "m", True), ("UJ-001", "Universal Joint", 2, "pcs", True)],
    ]

    for i, (pid, plid) in enumerate([(prod_ids[0], line_ids[0]), (prod_ids[1], line_ids[0]),
                                       (prod_ids[2], line_ids[1]), (prod_ids[3], line_ids[1])]):
        if i >= len(bom_components):
            break
        r = conn.execute(text("""
            INSERT INTO bom_headers (factory_id, product_id, production_line_id, version, is_active,
                                     ideal_cycle_time_sec, batch_size, approved_by_id, approved_at, notes, created_at, updated_at)
            VALUES (:fid, :pid, :plid, '1.0', true, :ct, :bs, :uid, :now, :notes, :now, :now) RETURNING id
        """), {"fid": fid, "pid": pid, "plid": plid, "ct": 45 + i * 15, "bs": 100 - i * 10,
               "uid": demo_user_id, "notes": f"Standard BOM v1.0", "now": NOW})
        bom_id = r.fetchone()[0]
        bom_ids.append(bom_id)

        for seq, (mcode, mname, qty, uom, critical) in enumerate(bom_components[i], 1):
            conn.execute(text("""
                INSERT INTO bom_components (bom_id, sequence, material_code, material_name, quantity_per_unit, unit_of_measure, is_critical, created_at, updated_at)
                VALUES (:bid, :seq, :mc, :mn, :qty, :uom, :crit, :now, :now)
            """), {"bid": bom_id, "seq": seq, "mc": mcode, "mn": mname, "qty": qty, "uom": uom, "crit": critical, "now": NOW})
    print(f"  BOMs: {len(bom_ids)} with components")

    # -----------------------------------------------------------------------
    # 6. Production Orders (various statuses)
    # -----------------------------------------------------------------------
    po_data = [
        ("PO-2026-001", "COMPLETED", prod_ids[0], line_ids[0], bom_ids[0], 500, 487, 13, -10, -5, "CUST-AUT-2026-01"),
        ("PO-2026-002", "COMPLETED", prod_ids[1], line_ids[0], bom_ids[1], 300, 291, 9, -8, -3, "CUST-AUT-2026-02"),
        ("PO-2026-003", "IN_PROGRESS", prod_ids[2], line_ids[1], bom_ids[2], 200, 142, 5, -3, None, "CUST-TRN-2026-01"),
        ("PO-2026-004", "RELEASED", prod_ids[3], line_ids[1], bom_ids[3], 150, 0, 0, 1, None, None),
        ("PO-2026-005", "PLANNED", prod_ids[0], line_ids[0], bom_ids[0], 600, 0, 0, 5, None, "CUST-AUT-2026-03"),
        ("PO-2026-006", "ON_HOLD", prod_ids[4], line_ids[3], None, 100, 35, 3, -5, None, "CUST-CHS-2026-01"),
    ]
    po_ids = []
    for onum, status, pid, plid, bid, planned, good, scrap, start_offset, end_offset, cust_ref in po_data:
        ps = TODAY + timedelta(days=start_offset)
        pe = (TODAY + timedelta(days=end_offset)) if end_offset else (ps + timedelta(days=10))
        actual_start = ps if status not in ("PLANNED",) else None
        actual_end = pe if status == "COMPLETED" else None
        closed_at = actual_end

        r = conn.execute(text("""
            INSERT INTO production_orders (factory_id, production_line_id, product_id, bom_id, created_by_id,
                order_number, status, planned_quantity, actual_quantity_good, actual_quantity_scrap,
                planned_start, planned_end, actual_start, actual_end, customer_ref, notes, closed_at, created_at, updated_at)
            VALUES (:fid, :plid, :pid, :bid, :uid, :onum, :status, :pq, :good, :scrap,
                :ps, :pe, :as_, :ae, :cr, :notes, :ca, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "pid": pid, "bid": bid, "uid": demo_user_id,
               "onum": onum, "status": E(status), "pq": planned, "good": good, "scrap": scrap,
               "ps": ps, "pe": pe, "as_": actual_start, "ae": actual_end, "cr": cust_ref,
               "notes": f"Demo production order {onum}", "ca": closed_at, "now": NOW})
        po_ids.append(r.fetchone()[0])
    print(f"  Production Orders: {len(po_ids)}")

    # -----------------------------------------------------------------------
    # 7. Production Records (last 14 days for lines 0-2)
    # -----------------------------------------------------------------------
    pr_ids = []
    for day_offset in range(14, 0, -1):
        rec_date = TODAY - timedelta(days=day_offset)
        for li in range(3):  # First 3 lines
            lid = line_ids[li]
            sid = shift_ids[lid][0]  # Morning shift
            planned_min = random.randint(420, 480)
            run_min = planned_min - random.randint(15, 60)
            total = random.randint(200, 500)
            good = total - random.randint(2, 20)
            cycle = random.uniform(30, 90)
            operator_id = random.choice(user_ids[2:5])  # operators

            r = conn.execute(text("""
                INSERT INTO production_records (production_line_id, shift_id, recorded_by_id, date,
                    planned_production_time_min, actual_run_time_min, total_pieces, good_pieces,
                    ideal_cycle_time_sec, notes, created_at, updated_at)
                VALUES (:lid, :sid, :uid, :d, :ppt, :art, :tp, :gp, :ict, :notes, :now, :now) RETURNING id
            """), {"lid": lid, "sid": sid, "uid": operator_id, "d": rec_date,
                   "ppt": planned_min, "art": run_min, "tp": total, "gp": good,
                   "ict": round(cycle, 1), "notes": f"Shift record {rec_date}", "now": NOW})
            pr_ids.append(r.fetchone()[0])
    print(f"  Production Records: {len(pr_ids)}")

    # -----------------------------------------------------------------------
    # 8. Downtime Events
    # -----------------------------------------------------------------------
    dt_categories = ["planned", "unplanned", "changeover", "maintenance", "material", "quality"]
    dt_reasons = {
        "planned": ["Scheduled maintenance", "Tooling change", "Break"],
        "unplanned": ["Motor overheating", "Sensor malfunction", "Conveyor jam"],
        "changeover": ["Product changeover A→B", "Die change", "Fixture swap"],
        "maintenance": ["Bearing replacement", "Oil leak repair", "Calibration"],
        "material": ["Raw material delay", "Wrong spec received", "Inventory shortage"],
        "quality": ["Out-of-spec parts", "Tool wear detected", "SPC alarm"],
    }
    dt_count = 0
    for pr_id in random.sample(pr_ids, min(30, len(pr_ids))):
        cat = random.choice(dt_categories)
        reason = random.choice(dt_reasons[cat])
        dur = random.randint(5, 60)
        base_time = datetime.combine(TODAY - timedelta(days=random.randint(1, 14)), time(7, 0), tzinfo=timezone.utc)
        start = base_time + timedelta(minutes=random.randint(0, 360))

        conn.execute(text("""
            INSERT INTO downtime_events (production_line_id, production_record_id, recorded_by_id,
                start_time, end_time, duration_minutes, category, reason, notes, created_at, updated_at)
            VALUES (
                (SELECT production_line_id FROM production_records WHERE id = :prid),
                :prid, :uid, :st, :et, :dur, :cat, :reason, :notes, :now, :now)
        """), {"prid": pr_id, "uid": random.choice(user_ids[2:5]), "st": start,
               "et": start + timedelta(minutes=dur), "dur": dur, "cat": E(cat),
               "reason": reason, "notes": f"DT: {reason}", "now": NOW})
        dt_count += 1
    print(f"  Downtime Events: {dt_count}")

    # -----------------------------------------------------------------------
    # 9. Scrap Records
    # -----------------------------------------------------------------------
    defect_types = ["Dimensional", "Surface finish", "Porosity", "Crack", "Wrong material", "Contamination"]
    scrap_count = 0
    for pr_id in random.sample(pr_ids, min(20, len(pr_ids))):
        conn.execute(text("""
            INSERT INTO scrap_records (production_line_id, production_record_id, recorded_by_id, date,
                quantity, defect_type, defect_description, cost_estimate, root_cause, created_at, updated_at)
            VALUES (
                (SELECT production_line_id FROM production_records WHERE id = :prid),
                :prid, :uid, :d, :qty, :dt, :dd, :cost, :rc, :now, :now)
        """), {"prid": pr_id, "uid": random.choice(user_ids[2:5]),
               "d": TODAY - timedelta(days=random.randint(1, 14)),
               "qty": random.randint(1, 10), "dt": random.choice(defect_types),
               "dd": "Defective parts found during inspection",
               "cost": round(random.uniform(5, 200), 2),
               "rc": "Under investigation", "now": NOW})
        scrap_count += 1
    print(f"  Scrap Records: {scrap_count}")

    # -----------------------------------------------------------------------
    # 10. OEE Records (last 14 days)
    # -----------------------------------------------------------------------
    oee_count = 0
    for day_offset in range(14, 0, -1):
        rec_date = TODAY - timedelta(days=day_offset)
        for lid in line_ids[:3]:
            avail = round(random.uniform(80, 98), 1)
            perf = round(random.uniform(75, 95), 1)
            qual = round(random.uniform(92, 99.5), 1)
            oee = round(avail * perf * qual / 10000, 1)
            planned = 480
            run_t = round(planned * avail / 100)
            total_p = random.randint(200, 500)
            good_p = round(total_p * qual / 100)
            dt_min = planned - run_t

            conn.execute(text("""
                INSERT INTO oee_records (production_line_id, date, availability, performance, quality, oee,
                    planned_time_min, run_time_min, total_pieces, good_pieces, downtime_min, created_at, updated_at)
                VALUES (:lid, :d, :a, :p, :q, :oee, :pt, :rt, :tp, :gp, :dm, :now, :now)
            """), {"lid": lid, "d": rec_date, "a": avail, "p": perf, "q": qual, "oee": oee,
                   "pt": planned, "rt": run_t, "tp": total_p, "gp": good_p, "dm": dt_min, "now": NOW})
            oee_count += 1
    print(f"  OEE Records: {oee_count}")

    # -----------------------------------------------------------------------
    # 11. Defect Catalog
    # -----------------------------------------------------------------------
    defects_data = [
        ("DEF-001", "Dimensional Out of Spec", "major", "Dimensional", 1),
        ("DEF-002", "Surface Scratch", "minor", "Surface", 2),
        ("DEF-003", "Porosity", "critical", "Casting", 3),
        ("DEF-004", "Weld Crack", "critical", "Welding", 4),
        ("DEF-005", "Paint Orange Peel", "minor", "Coating", 5),
        ("DEF-006", "Wrong Torque", "major", "Assembly", 6),
        ("DEF-007", "Missing Component", "major", "Assembly", 7),
        ("DEF-008", "Burr Remaining", "minor", "Machining", 8),
        ("DEF-009", "Corrosion Spot", "major", "Material", 9),
        ("DEF-010", "Thread Damage", "major", "Machining", 10),
    ]
    defect_ids = []
    for code, name, severity, category, sort in defects_data:
        r = conn.execute(text("""
            INSERT INTO defect_catalog (factory_id, code, name, severity, category, is_active, sort_order, created_at, updated_at)
            VALUES (:fid, :code, :name, :sev, :cat, true, :sort, :now, :now) RETURNING id
        """), {"fid": fid, "code": code, "name": name, "sev": E(severity), "cat": category, "sort": sort, "now": NOW})
        defect_ids.append(r.fetchone()[0])
    print(f"  Defect Catalog: {len(defect_ids)}")

    # -----------------------------------------------------------------------
    # 12. QC Templates
    # -----------------------------------------------------------------------
    qc_templates_data = [
        ("Line Clearance - Assembly A", "line_clearance", line_ids[0], [
            ("Cleanliness", "checkbox", "Work area clean and free of debris", None, None, None, True, True),
            ("Previous Product Removed", "checkbox", "All parts from previous run removed", None, None, None, True, True),
            ("Tools Verified", "checkbox", "Correct tools staged for next run", None, None, None, False, True),
            ("Documentation Ready", "checkbox", "Work instructions and specs available", None, None, None, False, True),
        ]),
        ("In-Process Inspection - Engine Block", "in_process", line_ids[0], [
            ("Bore Diameter", "measurement", "Main bore diameter within spec", 82.95, 83.05, "mm", True, True),
            ("Surface Roughness Ra", "measurement", "Bore surface roughness", None, 1.6, "um", True, True),
            ("Deck Height", "measurement", "Block deck height", 226.9, 227.1, "mm", True, True),
            ("Visual Check", "checkbox", "No visible casting defects", None, None, None, True, True),
            ("Torque Check", "measurement", "Head bolt torque", 58, 62, "Nm", True, True),
        ]),
        ("Final Inspection - Gearbox", "final_inspection", line_ids[1], [
            ("Gear Mesh Test", "checkbox", "Smooth gear engagement all ratios", None, None, None, True, True),
            ("Oil Leak Check", "checkbox", "No oil leaks at seals", None, None, None, True, True),
            ("Noise Level", "measurement", "Operating noise level", None, 65, "dB", False, True),
            ("Shift Feel", "text", "Subjective shift quality assessment", None, None, None, False, False),
            ("Weight Check", "measurement", "Total assembly weight", 28.5, 29.5, "kg", False, True),
        ]),
        ("FGA - CNC Parts", "fga", line_ids[2], [
            ("First Article Dims", "measurement", "Critical dimension 1", 49.95, 50.05, "mm", True, True),
            ("Thread Gauge", "checkbox", "Go/NoGo thread gauge passes", None, None, None, True, True),
            ("Hardness", "measurement", "Surface hardness", 58, 62, "HRC", True, True),
        ]),
    ]
    qc_tmpl_ids = []
    for tname, ttype, plid, items in qc_templates_data:
        r = conn.execute(text("""
            INSERT INTO qc_templates (factory_id, production_line_id, created_by_id,
                name, template_type, version, is_active, estimated_time_min, description,
                pass_threshold_pct, critical_items_must_pass, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :name, :tt, '1.0', true, :time, :desc, 80, true, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "uid": demo_user_id, "name": tname, "tt": E(ttype),
               "time": len(items) * 3, "desc": f"Standard {ttype} template", "now": NOW})
        tmpl_id = r.fetchone()[0]
        qc_tmpl_ids.append(tmpl_id)

        for idx, (cat, ctype, desc, ll, ul, unit, crit, mand) in enumerate(items, 1):
            conn.execute(text("""
                INSERT INTO qc_template_items (template_id, item_order, category, check_type, description,
                    specification, lower_limit, upper_limit, unit, is_critical, is_mandatory, created_at, updated_at)
                VALUES (:tid, :ord, :cat, :ct, :desc, :spec, :ll, :ul, :unit, :crit, :mand, :now, :now)
            """), {"tid": tmpl_id, "ord": idx, "cat": cat, "ct": E(ctype), "desc": desc,
                   "spec": desc, "ll": ll, "ul": ul, "unit": unit, "crit": crit, "mand": mand, "now": NOW})
    print(f"  QC Templates: {len(qc_tmpl_ids)} with items")

    # -----------------------------------------------------------------------
    # 13. QC Records (some passed, some failed)
    # -----------------------------------------------------------------------
    qc_rec_ids = []
    qc_statuses = ["passed", "passed", "passed", "passed_with_deviations", "failed"]
    for tmpl_id in qc_tmpl_ids:
        for i in range(4):
            status = random.choice(qc_statuses)
            score = random.randint(60, 100) if status != "failed" else random.randint(30, 60)
            completed = NOW - timedelta(days=random.randint(1, 10), hours=random.randint(0, 8))
            r = conn.execute(text("""
                INSERT INTO qc_records (factory_id, template_id, production_line_id, performed_by_id,
                    check_type, status, started_at, completed_at, overall_score_pct, notes, created_at, updated_at)
                VALUES (:fid, :tid,
                    (SELECT production_line_id FROM qc_templates WHERE id = :tid),
                    :uid, (SELECT template_type FROM qc_templates WHERE id = :tid),
                    :status, :started, :completed, :score, :notes, :now, :now) RETURNING id
            """), {"fid": fid, "tid": tmpl_id, "uid": random.choice(user_ids[1:4]),
                   "status": E(status), "started": completed - timedelta(minutes=random.randint(10, 30)),
                   "completed": completed, "score": score, "notes": f"QC inspection #{i+1}", "now": NOW})
            qc_rec_ids.append(r.fetchone()[0])
    print(f"  QC Records: {len(qc_rec_ids)}")

    # -----------------------------------------------------------------------
    # 14. NCRs
    # -----------------------------------------------------------------------
    ncr_data = [
        ("NCR-2026-001", "Bore diameter out of spec on batch 42", "critical", "open", "Tooling wear detected"),
        ("NCR-2026-002", "Surface scratches on 5 gearbox housings", "major", "under_investigation", None),
        ("NCR-2026-003", "Wrong torque applied to 12 assemblies", "major", "pending_capa", "Torque wrench not calibrated"),
        ("NCR-2026-004", "Paint thickness below minimum on 3 frames", "minor", "closed", "Spray nozzle clogged"),
    ]
    ncr_ids = []
    for ncr_num, title, severity, status, rc in ncr_data:
        r = conn.execute(text("""
            INSERT INTO non_conformance_reports (factory_id, production_line_id, raised_by_id,
                ncr_number, title, description, severity, status, detected_at,
                quantity_affected, root_cause, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :num, :title, :desc, :sev, :status, :det, :qty, :rc, :now, :now)
            RETURNING id
        """), {"fid": fid, "plid": random.choice(line_ids[:3]), "uid": random.choice(user_ids[:3]),
               "num": ncr_num, "title": title, "desc": f"NCR: {title}", "sev": E(severity),
               "status": E(status), "det": NOW - timedelta(days=random.randint(1, 10)),
               "qty": random.randint(1, 20), "rc": rc, "now": NOW})
        ncr_ids.append(r.fetchone()[0])
    print(f"  NCRs: {len(ncr_ids)}")

    # -----------------------------------------------------------------------
    # 15. CAPAs
    # -----------------------------------------------------------------------
    capa_data = [
        ("CAPA-2026-001", "corrective", "Replace worn boring tool", "high", "in_progress", ncr_ids[0]),
        ("CAPA-2026-002", "preventive", "Implement torque wrench calibration schedule", "medium", "implemented", ncr_ids[2]),
        ("CAPA-2026-003", "corrective", "Clean and inspect all spray nozzles", "low", "verified", ncr_ids[3]),
    ]
    for cnum, ctype, title, priority, status, ncr_id in capa_data:
        conn.execute(text("""
            INSERT INTO capa_actions (factory_id, ncr_id, created_by_id, owner_id,
                capa_number, capa_type, title, description, root_cause,
                status, priority, due_date, created_at, updated_at)
            VALUES (:fid, :nid, :uid, :owner, :num, :ct, :title, :desc, :rc,
                :status, :pri, :due, :now, :now)
        """), {"fid": fid, "nid": ncr_id, "uid": demo_user_id, "owner": user_ids[1],
               "num": cnum, "ct": E(ctype), "title": title, "desc": f"CAPA: {title}",
               "rc": "Root cause identified in NCR investigation",
               "status": E(status), "pri": E(priority),
               "due": TODAY + timedelta(days=random.randint(7, 30)), "now": NOW})
    print(f"  CAPAs: {len(capa_data)}")

    # -----------------------------------------------------------------------
    # 16. Five Why Analyses
    # -----------------------------------------------------------------------
    five_why_data = [
        ("Recurring bore diameter failures", "Engine blocks from Line A failing dimensional inspection at bore diameter station"),
        ("Conveyor stoppage on Line B", "Conveyor belt on Assembly Line B stops unexpectedly during peak production"),
        ("High scrap rate on CNC lathe", "CNC Lathe WC-CNC-01 producing 5% scrap vs 1% target"),
    ]
    fw_ids = []
    for title, problem in five_why_data:
        r = conn.execute(text("""
            INSERT INTO five_why_analyses (factory_id, production_line_id, created_by_id,
                title, problem_statement, status, root_cause, countermeasure, responsible, due_date, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :title, :prob, :status, :rc, :cm, :resp, :due, :now, :now) RETURNING id
        """), {"fid": fid, "plid": random.choice(line_ids[:3]), "uid": demo_user_id, "status": E("completed"),
               "title": title, "prob": problem,
               "rc": "Tool wear not monitored systematically",
               "cm": "Implement tool life tracking system with automatic alerts",
               "resp": "Giulia Bianchi", "due": TODAY + timedelta(days=14), "now": NOW})
        fw_id = r.fetchone()[0]
        fw_ids.append(fw_id)

        # Steps
        whys = [
            ("Why did the bore fail spec?", "The boring tool was worn beyond tolerance"),
            ("Why was the tool worn?", "It exceeded its expected tool life"),
            ("Why was tool life exceeded?", "No tracking system for tool usage cycles"),
            ("Why is there no tracking?", "The monitoring feature was never implemented"),
            ("Why wasn't it implemented?", "It was deprioritized during initial setup"),
        ]
        for step_num, (q, a) in enumerate(whys, 1):
            conn.execute(text("""
                INSERT INTO five_why_steps (analysis_id, step_number, why_question, answer, created_at, updated_at)
                VALUES (:aid, :sn, :q, :a, :now, :now)
            """), {"aid": fw_id, "sn": step_num, "q": q, "a": a, "now": NOW})
    print(f"  Five Why Analyses: {len(fw_ids)}")

    # -----------------------------------------------------------------------
    # 17. Ishikawa Analyses
    # -----------------------------------------------------------------------
    ish_data = [
        ("High scrap rate analysis", "Excessive scrap rate on Assembly Line A"),
        ("Delivery delay root cause", "Customer delivery delays exceeding SLA"),
    ]
    ish_ids = []
    categories = ["man", "machine", "method", "material", "measurement", "environment"]
    cause_examples = {
        "man": [("Insufficient training", "New operators not certified"), ("Fatigue", "12-hour shifts")],
        "machine": [("Tool wear", "No predictive maintenance"), ("Calibration drift", "Monthly vs weekly needed")],
        "method": [("Outdated work instructions", "Rev. 2 in use, Rev. 4 released"), ("No standard work", "Each operator does differently")],
        "material": [("Batch variation", "Supplier quality inconsistent"), ("Wrong grade", "Specification not updated")],
        "measurement": [("Gauge R&R poor", "Measurement system needs validation"), ("No SPC", "Only end-of-line inspection")],
        "environment": [("Temperature variation", "No HVAC in machining area"), ("Dust contamination", "Open doors to warehouse")],
    }
    for title, effect in ish_data:
        r = conn.execute(text("""
            INSERT INTO ishikawa_analyses (factory_id, production_line_id, created_by_id,
                title, effect, conclusion, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :title, :effect, :concl, :now, :now) RETURNING id
        """), {"fid": fid, "plid": line_ids[0], "uid": demo_user_id,
               "title": title, "effect": effect,
               "concl": "Primary root cause identified in Machine and Method categories", "now": NOW})
        ish_id = r.fetchone()[0]
        ish_ids.append(ish_id)

        for cat in categories:
            for cause, sub_cause in cause_examples[cat]:
                is_root = cat in ("machine", "method") and "wear" in cause.lower()
                conn.execute(text("""
                    INSERT INTO ishikawa_causes (analysis_id, category, cause, sub_cause, is_root_cause, created_at, updated_at)
                    VALUES (:aid, :cat, :cause, :sub, :root, :now, :now)
                """), {"aid": ish_id, "cat": E(cat), "cause": cause, "sub": sub_cause, "root": is_root, "now": NOW})
    print(f"  Ishikawa Analyses: {len(ish_ids)}")

    # -----------------------------------------------------------------------
    # 18. Kaizen Items
    # -----------------------------------------------------------------------
    kaizen_data = [
        ("Implement tool life tracking", "Setup", "high", "in_progress", 5000, None, line_ids[0]),
        ("5S audit for CNC area", "Workplace", "medium", "completed", 2000, 1800, line_ids[2]),
        ("Reduce changeover time Line A", "SMED", "high", "planned", 8000, None, line_ids[0]),
        ("Standardize torque procedures", "Quality", "critical", "in_progress", 3000, None, line_ids[0]),
        ("Visual management boards", "Visual Management", "low", "idea", 500, None, None),
        ("Kanban for raw materials", "Flow", "medium", "planned", 4000, None, line_ids[1]),
        ("Poka-yoke fixture for welding", "Quality", "high", "completed", 6000, 5500, line_ids[3]),
        ("TPM autonomous maintenance", "Maintenance", "medium", "in_progress", 3500, None, line_ids[2]),
    ]
    kaizen_ids = []
    for title, cat, priority, status, expected, actual, plid in kaizen_data:
        start = TODAY - timedelta(days=random.randint(5, 30)) if status != "idea" else None
        target = TODAY + timedelta(days=random.randint(7, 60))
        compl = TODAY - timedelta(days=random.randint(1, 5)) if status == "completed" else None
        r = conn.execute(text("""
            INSERT INTO kaizen_items (factory_id, production_line_id, created_by_id, assigned_to_id,
                title, description, category, priority, status, expected_impact,
                expected_savings_eur, actual_savings_eur, start_date, target_date, completion_date, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :assigned, :title, :desc, :cat, :pri, :status, :impact,
                :expected, :actual, :start, :target, :compl, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "uid": demo_user_id, "assigned": random.choice(user_ids[1:4]),
               "title": title, "desc": f"Kaizen: {title}", "cat": cat, "pri": E(priority), "status": E(status),
               "impact": "Reduce waste and improve efficiency",
               "expected": expected, "actual": actual, "start": start, "target": target, "compl": compl, "now": NOW})
        kaizen_ids.append(r.fetchone()[0])
    print(f"  Kaizen Items: {len(kaizen_ids)}")

    # -----------------------------------------------------------------------
    # 19. SMED Records
    # -----------------------------------------------------------------------
    smed_data = [
        ("Product A → B Changeover", line_ids[0], 45, 28, 20),
        ("Die Change CNC Mill", line_ids[2], 60, 42, 30),
    ]
    for chg_name, plid, baseline, current, target in smed_data:
        r = conn.execute(text("""
            INSERT INTO smed_records (factory_id, production_line_id, created_by_id,
                changeover_name, baseline_time_min, current_time_min, target_time_min, date_recorded, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :name, :base, :curr, :tgt, :d, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "uid": demo_user_id,
               "name": chg_name, "base": baseline, "curr": current, "tgt": target,
               "d": TODAY - timedelta(days=5), "now": NOW})
        smed_id = r.fetchone()[0]

        steps = [
            ("Stop machine and secure", 120, "internal", False, None),
            ("Remove old die/tooling", 180, "internal", False, None),
            ("Pre-stage new tooling", 150, "external", True, "Can be done while machine runs"),
            ("Install new die/tooling", 240, "internal", False, None),
            ("Adjust and align", 300, "internal", False, "Consider quick-change fixtures"),
            ("First piece inspection", 180, "internal", True, "Move to external with pre-set gauges"),
            ("Ramp to full speed", 120, "internal", False, None),
        ]
        for idx, (desc, dur, phase, ext, notes) in enumerate(steps, 1):
            conn.execute(text("""
                INSERT INTO smed_steps (record_id, step_order, description, duration_seconds,
                    phase, can_be_externalized, improvement_notes, created_at, updated_at)
                VALUES (:rid, :ord, :desc, :dur, :phase, :ext, :notes, :now, :now)
            """), {"rid": smed_id, "ord": idx, "desc": desc, "dur": dur,
                   "phase": E(phase), "ext": ext, "notes": notes, "now": NOW})
    print(f"  SMED Records: {len(smed_data)}")

    # -----------------------------------------------------------------------
    # 20. Lean Assessment
    # -----------------------------------------------------------------------
    scores = {
        "leadership": 3.5, "strategy": 3.0, "people": 3.5, "partnerships": 2.5,
        "processes": 4.0, "customer_results": 3.5, "people_results": 3.0,
        "society_results": 2.0, "key_results": 3.5
    }
    conn.execute(text("""
        INSERT INTO lean_assessments (factory_id, assessed_by_id, scores, overall_score,
            maturity_level, recommendations, answers, created_at, updated_at)
        VALUES (:fid, :uid, :scores, :overall, :level, :recs, :answers, :now, :now)
    """), {"fid": fid, "uid": demo_user_id, "scores": json.dumps(scores),
           "overall": 3.2, "level": "Developing",
           "recs": json.dumps([
               "Strengthen visual management across all areas",
               "Implement daily Gemba walks for leadership",
               "Expand TPM to all production lines",
               "Develop standard work for all critical processes",
               "Launch company-wide Kaizen suggestion system"
           ]),
           "answers": json.dumps({"q1": "b", "q2": "c", "q3": "b", "q4": "a", "q5": "c",
                                    "q6": "b", "q7": "b", "q8": "c", "q9": "b"}),
           "now": NOW})
    print(f"  Lean Assessment: 1")

    # -----------------------------------------------------------------------
    # 21. 6S Audits
    # -----------------------------------------------------------------------
    areas = ["CNC Machining Area", "Assembly Line A", "Welding Cell", "Paint Booth"]
    sixs_questions = {
        "sort": ["Are unnecessary items removed?", "Is red-tag area maintained?", "Are only needed tools present?",
                 "Is scrap properly separated?", "Are personal items stored properly?"],
        "set_in_order": ["Are tools in designated locations?", "Is shadow board complete?", "Are aisles clearly marked?",
                         "Are labels readable and current?", "Can anyone find items within 30 seconds?"],
        "shine": ["Are floors clean?", "Are machines clean?", "Is cleaning schedule followed?",
                  "Are leaks identified and contained?", "Are waste bins emptied regularly?"],
        "standardize": ["Are standards posted and visible?", "Is color coding consistent?", "Are SOPs current?",
                        "Are responsibilities clearly assigned?", "Is there a visual management board?"],
        "sustain": ["Are audits conducted on schedule?", "Is management doing Gemba walks?", "Are improvements tracked?",
                    "Is training up to date?", "Are best practices shared across shifts?"],
        "safety": ["Are safety signs visible?", "Is PPE available and used?", "Are emergency exits clear?",
                   "Is first aid kit stocked?", "Are safety guards in place?"],
    }
    sixs_count = 0
    for area in areas:
        plid = random.choice(line_ids[:4])
        total_score = 0
        item_count = 0
        r = conn.execute(text("""
            INSERT INTO six_s_audits (factory_id, production_line_id, auditor_id,
                audit_date, area_name, overall_score, maturity_level, notes, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :d, :area, 0, 1, :notes, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "uid": random.choice(user_ids[:3]),
               "d": TODAY - timedelta(days=random.randint(1, 14)),
               "area": area, "notes": f"Monthly 6S audit for {area}", "now": NOW})
        audit_id = r.fetchone()[0]

        for cat, questions in sixs_questions.items():
            for q in questions:
                score = random.randint(2, 5)
                total_score += score
                item_count += 1
                finding = f"Score {score}/5" if score < 4 else None
                action = f"Improve {cat} in this area" if score < 3 else None
                conn.execute(text("""
                    INSERT INTO six_s_audit_items (audit_id, category, question, score,
                        finding, corrective_action, responsible, due_date, is_resolved, created_at, updated_at)
                    VALUES (:aid, :cat, :q, :score, :finding, :action, :resp, :due, :resolved, :now, :now)
                """), {"aid": audit_id, "cat": E(cat), "q": q, "score": score,
                       "finding": finding, "action": action,
                       "resp": "Team Leader" if action else None,
                       "due": TODAY + timedelta(days=14) if action else None,
                       "resolved": score >= 4, "now": NOW})

        avg = round(total_score / item_count * 20) if item_count else 0  # Convert 1-5 to 0-100
        maturity = min(5, max(1, avg // 20))
        conn.execute(text("UPDATE six_s_audits SET overall_score = :score, maturity_level = :ml WHERE id = :aid"),
                     {"score": avg, "ml": maturity, "aid": audit_id})
        sixs_count += 1
    print(f"  6S Audits: {sixs_count}")

    # -----------------------------------------------------------------------
    # 22. VSM Maps
    # -----------------------------------------------------------------------
    vsm_data = [
        ("Engine Block Value Stream - Current", "Engine Components", "current", 120, 12.5, 285, 3.8, 450),
        ("Engine Block Value Stream - Future", "Engine Components", "future", 120, 7.2, 260, 6.0, 450),
    ]
    for title, family, mtype, takt, lead, proc, pce, demand in vsm_data:
        r = conn.execute(text("""
            INSERT INTO vsm_maps (factory_id, created_by_id, title, product_family, map_type,
                takt_time_sec, total_lead_time_days, total_processing_time_min, pce_ratio,
                customer_demand_per_day, notes, created_at, updated_at)
            VALUES (:fid, :uid, :title, :fam, :mt, :takt, :lead, :proc, :pce, :demand, :notes, :now, :now)
            RETURNING id
        """), {"fid": fid, "uid": demo_user_id, "title": title, "fam": family, "mt": mtype,
               "takt": takt, "lead": lead, "proc": proc, "pce": pce, "demand": demand,
               "notes": f"{mtype.title()} state value stream map", "now": NOW})
        vsm_id = r.fetchone()[0]

        steps_vs = [
            ("Raw Material Receiving", 30, 15, 100, 2, 500, 24, False, False),
            ("CNC Machining", 90, 30, 92, 1, 200, 8, mtype == "current", True),
            ("Heat Treatment", 120, 60, 95, 0, 300, 16, False, False),
            ("Grinding", 60, 20, 88, 1, 150, 4, True, mtype == "future"),
            ("Assembly", 45, 10, 96, 2, 100, 2, False, False),
            ("Final Inspection", 15, 5, 99, 1, 50, 1, False, False),
            ("Shipping", 10, 0, 100, 1, 30, 0, False, False),
        ]
        for idx, (pname, ct, cot, up, ops, wip, wait, bottleneck, kaizen) in enumerate(steps_vs, 1):
            conn.execute(text("""
                INSERT INTO vsm_steps (vsm_map_id, step_order, process_name, cycle_time_sec, changeover_time_min,
                    uptime_pct, operators, wip_before, wait_time_hours, is_bottleneck, is_kaizen_burst, notes, created_at, updated_at)
                VALUES (:vid, :ord, :pn, :ct, :cot, :up, :ops, :wip, :wait, :bn, :kb, :notes, :now, :now)
            """), {"vid": vsm_id, "ord": idx, "pn": pname, "ct": ct, "cot": cot, "up": up,
                   "ops": ops, "wip": wip, "wait": wait, "bn": bottleneck, "kb": kaizen,
                   "notes": None, "now": NOW})
    print(f"  VSM Maps: {len(vsm_data)}")

    # -----------------------------------------------------------------------
    # 23. A3 Reports
    # -----------------------------------------------------------------------
    a3_data = [
        ("Reduce scrap rate on Assembly Line A", "in_progress",
         "Assembly Line A scrap rate has increased from 2% to 5% over the last quarter",
         "Current scrap rate is 5.2%, mainly from dimensional failures at bore station",
         "Reduce scrap rate to below 1.5% within 3 months",
         "Tool wear not monitored; no predictive replacement schedule",
         "1. Implement tool life monitoring\n2. Create replacement schedule\n3. Train operators on wear indicators",
         "Phase 1: Tool tracking (Week 1-2)\nPhase 2: Alert system (Week 3-4)\nPhase 3: Training (Week 5-6)",
         "Monthly scrap rate review. Target: <1.5% sustained for 3 months",
         None),
        ("Improve OEE on CNC Line", "draft",
         "CNC machining line OEE has been declining for 2 months",
         "Current OEE is 72% vs target of 85%. Main losses: unplanned downtime and changeover",
         "Achieve 85% OEE within 2 months",
         "Under investigation", None, None, None, None),
    ]
    for title, status, bg, cc, goal, rca, cm, ip, fu, results in a3_data:
        conn.execute(text("""
            INSERT INTO a3_reports (factory_id, created_by_id, title, status,
                background, current_condition, goal_statement, root_cause_analysis,
                countermeasures, implementation_plan, follow_up, results,
                target_date, created_at, updated_at)
            VALUES (:fid, :uid, :title, :status, :bg, :cc, :goal, :rca, :cm, :ip, :fu, :res,
                :td, :now, :now)
        """), {"fid": fid, "uid": demo_user_id, "title": title, "status": E(status),
               "bg": bg, "cc": cc, "goal": goal, "rca": rca, "cm": cm, "ip": ip,
               "fu": fu, "res": results, "td": TODAY + timedelta(days=60), "now": NOW})
    print(f"  A3 Reports: {len(a3_data)}")

    # -----------------------------------------------------------------------
    # 24. Gemba Walks
    # -----------------------------------------------------------------------
    gemba_data = [
        ("Assembly Line A", "Safety", 45, "Observed good 5S practices. Identified 2 safety improvement opportunities."),
        ("CNC Machining", "Quality", 30, "SPC charts not updated. Operators need refresher training on measurement procedures."),
        ("Welding Cell", "Productivity", 35, "Robot welder idle time high. Material staging area disorganized."),
        ("Paint Booth", "Environment", 25, "Good housekeeping. VOC monitoring needs calibration check."),
    ]
    for area, theme, dur, summary in gemba_data:
        r = conn.execute(text("""
            INSERT INTO gemba_walks (factory_id, walker_id, walk_date, area, duration_min,
                theme, summary, created_at, updated_at)
            VALUES (:fid, :uid, :d, :area, :dur, :theme, :summary, :now, :now) RETURNING id
        """), {"fid": fid, "uid": random.choice(user_ids[:2]),
               "d": TODAY - timedelta(days=random.randint(1, 7)),
               "area": area, "dur": dur, "theme": theme, "summary": summary, "now": NOW})
        walk_id = r.fetchone()[0]

        observations = [
            ("positive", f"Good practice observed in {area}", area, False, "completed", "low"),
            ("concern", f"Improvement opportunity in {area}", area, True, "open", "medium"),
            ("safety", f"Minor safety observation in {area}", area, True, "open", "high"),
        ]
        for otype, desc, loc, action_req, status, priority in observations:
            conn.execute(text("""
                INSERT INTO gemba_observations (walk_id, observation_type, description,
                    location, action_required, assigned_to, due_date, status, priority, created_at, updated_at)
                VALUES (:wid, :ot, :desc, :loc, :ar, :at, :due, :status, :pri, :now, :now)
            """), {"wid": walk_id, "ot": otype, "desc": desc, "loc": loc,
                   "ar": action_req, "at": "Giulia Bianchi" if action_req else None,
                   "due": TODAY + timedelta(days=7) if action_req else None,
                   "status": status, "pri": priority, "now": NOW})
    print(f"  Gemba Walks: {len(gemba_data)}")

    # -----------------------------------------------------------------------
    # 25. TPM Equipment + Maintenance
    # -----------------------------------------------------------------------
    tpm_data = [
        ("Hydraulic Press HP-01", "HP-01", "Assembly A", "high", line_ids[0], 720, 2.5),
        ("CNC Lathe CL-01", "CL-01", "CNC Area", "high", line_ids[2], 500, 3.0),
        ("CNC Mill CM-01", "CM-01", "CNC Area", "medium", line_ids[2], 600, 2.0),
        ("Robot Welder RW-01", "RW-01", "Welding Cell", "critical", line_ids[3], 400, 4.0),
        ("Paint Spray PS-01", "PS-01", "Paint Booth", "medium", line_ids[4], 800, 1.5),
        ("Conveyor CV-01", "CV-01", "Assembly A", "low", line_ids[0], 2000, 1.0),
    ]
    equip_ids = []
    for name, code, loc, crit, plid, mtbf, mttr in tpm_data:
        r = conn.execute(text("""
            INSERT INTO tpm_equipment (factory_id, production_line_id, name, equipment_code, location,
                criticality, mtbf_hours, mttr_hours, last_maintenance_date, next_planned_maintenance, created_at, updated_at)
            VALUES (:fid, :plid, :name, :code, :loc, :crit, :mtbf, :mttr, :last, :next, :now, :now) RETURNING id
        """), {"fid": fid, "plid": plid, "name": name, "code": code, "loc": loc,
               "crit": crit, "mtbf": mtbf, "mttr": mttr,
               "last": TODAY - timedelta(days=random.randint(7, 30)),
               "next": TODAY + timedelta(days=random.randint(7, 30)), "now": NOW})
        equip_ids.append(r.fetchone()[0])

    # Maintenance records
    maint_types = ["preventive", "corrective", "predictive", "autonomous"]
    pillars = ["autonomous_maintenance", "planned_maintenance", "focused_improvement", "quality_maintenance"]
    maint_count = 0
    for eid in equip_ids:
        for _ in range(random.randint(2, 5)):
            mt = random.choice(maint_types)
            conn.execute(text("""
                INSERT INTO tpm_maintenance_records (equipment_id, performed_by_id,
                    maintenance_type, pillar, description, duration_min, date_performed,
                    parts_replaced, cost_eur, findings, next_action, created_at, updated_at)
                VALUES (:eid, :uid, :mt, :pillar, :desc, :dur, :dp, :parts, :cost, :findings, :na, :now, :now)
            """), {"eid": eid, "uid": random.choice(user_ids[2:5]),
                   "mt": mt, "pillar": E(random.choice(pillars)),
                   "desc": f"{mt.title()} maintenance performed",
                   "dur": random.randint(15, 120),
                   "dp": TODAY - timedelta(days=random.randint(1, 30)),
                   "parts": json.dumps(["Filter", "O-ring"] if mt == "preventive" else []),
                   "cost": round(random.uniform(20, 500), 2),
                   "findings": "Equipment in acceptable condition" if mt == "preventive" else "Issue resolved",
                   "na": "Continue monitoring" if mt != "corrective" else "Verify fix in 7 days",
                   "now": NOW})
            maint_count += 1
    print(f"  TPM Equipment: {len(equip_ids)}, Maintenance Records: {maint_count}")

    # -----------------------------------------------------------------------
    # 26. CILT Standards + Executions
    # -----------------------------------------------------------------------
    cilt_data = [
        ("CNC Lathe Daily CILT", "CNC Area", "daily", equip_ids[1], line_ids[2], [
            ("cleaning", "Clean chuck and bed", "Wipe with lint-free cloth", "Clean surface", None, 120),
            ("cleaning", "Remove chips from enclosure", "Air blow + vacuum", "No chips visible", "Air gun", 180),
            ("inspection", "Check coolant level", "Visual check on gauge", ">50%", None, 30),
            ("inspection", "Inspect tool holder runout", "Dial indicator check", "<0.01mm", "Dial indicator", 120),
            ("lubrication", "Lubricate way covers", "Apply grease to slides", "Smooth movement", "Grease gun", 60),
            ("lubrication", "Check hydraulic oil level", "Sight glass check", "Between min-max", None, 30),
            ("tightening", "Check chuck jaw torque", "Torque wrench verification", "45-50 Nm", "Torque wrench", 60),
            ("tightening", "Verify tailstock lock", "Manual check", "Secure", None, 30),
            ("tightening", "Check tool holder clamp", "Manual pull test", "No movement", None, 30),
        ]),
        ("Robot Welder Weekly CILT", "Welding Cell", "weekly", equip_ids[3], line_ids[3], [
            ("cleaning", "Clean wire feed mechanism", "Compressed air + brush", "No debris", "Air gun", 300),
            ("cleaning", "Clean torch nozzle", "Anti-spatter + wire brush", "Clear nozzle", "Wire brush", 120),
            ("inspection", "Check gas flow rate", "Flow meter reading", "15-20 L/min", "Flow meter", 60),
            ("inspection", "Inspect contact tip wear", "Visual + measurement", "<0.5mm wear", "Caliper", 60),
            ("inspection", "Check cable condition", "Visual inspection", "No damage", None, 120),
            ("lubrication", "Grease robot joints", "Apply per schedule", "Smooth motion", "Grease gun", 300),
            ("tightening", "Verify fixture clamps", "Torque check all 8 clamps", "30-35 Nm", "Torque wrench", 180),
        ]),
    ]
    cilt_count = 0
    for name, area, freq, eid, plid, items in cilt_data:
        r = conn.execute(text("""
            INSERT INTO cilt_standards (factory_id, equipment_id, production_line_id,
                name, area, frequency, estimated_time_min, created_at, updated_at)
            VALUES (:fid, :eid, :plid, :name, :area, :freq, :est, :now, :now) RETURNING id
        """), {"fid": fid, "eid": eid, "plid": plid, "name": name, "area": area, "freq": E(freq),
               "est": sum(t for _, _, _, _, _, t in items) // 60, "now": NOW})
        std_id = r.fetchone()[0]

        item_ids = []
        for idx, (cat, desc, method, std_val, tool, time_s) in enumerate(items, 1):
            r2 = conn.execute(text("""
                INSERT INTO cilt_items (standard_id, item_order, category, description,
                    method, standard_value, tool_required, time_seconds, created_at, updated_at)
                VALUES (:sid, :ord, :cat, :desc, :method, :sv, :tool, :time, :now, :now) RETURNING id
            """), {"sid": std_id, "ord": idx, "cat": E(cat), "desc": desc, "method": method,
                   "sv": std_val, "tool": tool, "time": time_s, "now": NOW})
            item_ids.append(r2.fetchone()[0])

        # Create 5 execution records
        for day_off in range(5, 0, -1):
            exec_date = TODAY - timedelta(days=day_off)
            all_ok = random.random() > 0.2
            r3 = conn.execute(text("""
                INSERT INTO cilt_executions (standard_id, operator_id, execution_date, shift,
                    duration_min, all_ok, notes, created_at, updated_at)
                VALUES (:sid, :uid, :ed, :shift, :dur, :ok, :notes, :now, :now) RETURNING id
            """), {"sid": std_id, "uid": random.choice(user_ids[2:5]),
                   "ed": exec_date, "shift": "Morning",
                   "dur": random.randint(8, 20), "ok": all_ok,
                   "notes": "All checks completed" if all_ok else "Anomaly found - see details",
                   "now": NOW})
            exec_id = r3.fetchone()[0]

            for iid in item_ids:
                status = "ok" if (all_ok or random.random() > 0.3) else "nok"
                conn.execute(text("""
                    INSERT INTO cilt_checks (execution_id, item_id, status, anomaly_description, created_at, updated_at)
                    VALUES (:eid, :iid, :status, :anomaly, :now, :now)
                """), {"eid": exec_id, "iid": iid, "status": status,
                       "anomaly": "Requires attention" if status == "nok" else None, "now": NOW})
            cilt_count += 1
    print(f"  CILT Standards: {len(cilt_data)}, Executions: {cilt_count}")

    # -----------------------------------------------------------------------
    # 27. Andon Events
    # -----------------------------------------------------------------------
    andon_statuses = ["green", "yellow", "red", "blue"]
    andon_reasons = {
        "red": ["Machine breakdown", "Safety stop", "Critical quality issue"],
        "yellow": ["Material shortage warning", "Quality deviation", "Approaching cycle limit"],
        "blue": ["Operator assistance needed", "Tooling change required", "Supervisor call"],
        "green": ["Line running normally", "Issue resolved", "Shift start"],
    }
    andon_count = 0
    for _ in range(20):
        status = random.choice(["red", "yellow", "blue", "green", "green"])
        reason = random.choice(andon_reasons[status])
        triggered = NOW - timedelta(hours=random.randint(1, 168))
        resolved = triggered + timedelta(minutes=random.randint(5, 60)) if status != "green" else triggered

        conn.execute(text("""
            INSERT INTO andon_events (factory_id, production_line_id, triggered_by_id,
                status, reason, description, triggered_at, resolved_at, resolution_time_min,
                escalated, source, trigger_type, created_at, updated_at)
            VALUES (:fid, :plid, :uid, :status, :reason, :desc, :trig, :res, :rtm,
                :esc, :src, :tt, :now, :now)
        """), {"fid": fid, "plid": random.choice(line_ids), "uid": random.choice(user_ids[2:5]),
               "status": E(status), "reason": reason, "desc": f"Andon: {reason}",
               "trig": triggered, "res": resolved,
               "rtm": round((resolved - triggered).total_seconds() / 60, 1),
               "esc": status == "red" and random.random() > 0.5,
               "src": "manual", "tt": "operator", "now": NOW})
        andon_count += 1
    print(f"  Andon Events: {andon_count}")

    # -----------------------------------------------------------------------
    # 28. Hourly Production (last 3 days)
    # -----------------------------------------------------------------------
    hourly_count = 0
    for day_off in range(3, 0, -1):
        hp_date = TODAY - timedelta(days=day_off)
        for lid in line_ids[:3]:
            for hour in range(6, 22):  # Morning + Afternoon shifts
                shift_name = "Morning" if hour < 14 else "Afternoon"
                target = random.randint(40, 70)
                actual = target + random.randint(-15, 5)
                actual = max(0, actual)
                scrap_p = random.randint(0, 3)
                dt_m = random.randint(0, 10)
                is_win = actual >= target

                conn.execute(text("""
                    INSERT INTO hourly_production (production_line_id, date, hour, shift,
                        target_pieces, actual_pieces, scrap_pieces, downtime_min, is_win, notes, created_at, updated_at)
                    VALUES (:lid, :d, :h, :shift, :tgt, :act, :scrap, :dt, :win, :notes, :now, :now)
                """), {"lid": lid, "d": hp_date, "h": hour, "shift": shift_name,
                       "tgt": target, "act": actual, "scrap": scrap_p, "dt": dt_m,
                       "win": is_win, "notes": None, "now": NOW})
                hourly_count += 1
    print(f"  Hourly Production: {hourly_count}")

    # -----------------------------------------------------------------------
    # 29. AI Conversations (sample)
    # -----------------------------------------------------------------------
    r = conn.execute(text("""
        INSERT INTO ai_conversations (factory_id, user_id, title, created_at, updated_at)
        VALUES (:fid, :uid, 'How to improve OEE on Assembly Line A?', :now, :now) RETURNING id
    """), {"fid": fid, "uid": demo_user_id, "now": NOW})
    conv_id = r.fetchone()[0]

    messages = [
        ("user", "Our Assembly Line A OEE has dropped to 72%. What are the main areas we should focus on?"),
        ("assistant", "Based on your data, I can see three main loss categories:\n\n1. **Availability (82%)** - You have significant unplanned downtime, primarily from motor overheating and sensor malfunctions. I recommend implementing predictive maintenance monitoring.\n\n2. **Performance (88%)** - Minor stoppages account for 5% loss. Consider implementing autonomous maintenance (TPM Pillar 1).\n\n3. **Quality (98.5%)** - This is your strongest area, but the bore diameter issues in NCR-2026-001 need attention.\n\n**Quick wins:**\n- Implement tool life tracking (currently in your Kaizen backlog)\n- Schedule preventive maintenance during planned breaks\n- Update SPC control charts at the bore station"),
        ("user", "Can you create a Kaizen plan for the tool life tracking?"),
        ("assistant", "I've drafted a Kaizen improvement plan:\n\n**Title:** Tool Life Tracking System Implementation\n**Category:** Setup/Maintenance\n**Priority:** High\n**Expected savings:** ~€5,000/month from reduced scrap\n\n**Steps:**\n1. Install cycle counters on all CNC tools (Week 1)\n2. Establish baseline tool life data (Week 2-3)\n3. Set up alert thresholds at 80% of tool life (Week 3)\n4. Train operators on the new dashboard (Week 4)\n5. Monitor and adjust thresholds (Week 5-8)\n\nWould you like me to create this as a formal Kaizen item?"),
    ]
    for role, content in messages:
        conn.execute(text("""
            INSERT INTO ai_messages (conversation_id, role, content, tokens_used, created_at, updated_at)
            VALUES (:cid, :role, :content, :tokens, :now, :now)
        """), {"cid": conv_id, "role": role, "content": content,
               "tokens": len(content.split()) * 2, "now": NOW})

    # AI Suggestions
    suggestions = [
        ("oee_improvement", "Implement predictive maintenance for HP-01", "Hydraulic Press HP-01 MTBF trending down. Recommend vibration monitoring.", "high", "TPM", 0.85),
        ("waste_reduction", "Reduce changeover time on Assembly Line A", "Current changeover 28min, industry best practice for similar lines is 15min.", "medium", "SMED", 0.78),
        ("quality_improvement", "Deploy SPC at bore diameter station", "3 NCRs in last month related to bore diameter. SPC would catch drift early.", "high", "Kanban", 0.92),
    ]
    for stype, title, desc, priority, tool, conf in suggestions:
        conn.execute(text("""
            INSERT INTO ai_kaizen_suggestions (factory_id, production_line_id,
                suggestion_type, title, description, expected_impact, lean_tool,
                confidence, priority_score, status, created_at, updated_at)
            VALUES (:fid, :plid, :st, :title, :desc, :impact, :tool, :conf, :pri, :ai_status, :now, :now)
        """), {"fid": fid, "plid": line_ids[0], "st": stype, "title": title, "desc": desc,
               "impact": f"Estimated {random.randint(5, 20)}% improvement",
               "tool": tool, "conf": conf,
               "pri": round(conf * 10, 1), "ai_status": E("pending"), "now": NOW})
    print(f"  AI Conversations: 1, Suggestions: {len(suggestions)}")

    # -----------------------------------------------------------------------
    # COMMIT
    # -----------------------------------------------------------------------
    conn.commit()
    print(f"\n{'='*60}")
    print(f"  DEMO DATA SEEDED SUCCESSFULLY")
    print(f"  Factory: {DEMO_FACTORY_NAME}")
    print(f"  Login:   {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"  To wipe: python seed_demo.py --wipe")
    print(f"  To clean only: python seed_demo.py --clean")
    print(f"{'='*60}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "seed"

    with engine.connect() as conn:
        if mode in ("--wipe", "--clean"):
            wipe_demo_data(conn)
            if mode == "--wipe":
                seed_demo_data(conn)
        else:
            seed_demo_data(conn)

    engine.dispose()
