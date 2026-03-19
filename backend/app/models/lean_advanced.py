from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


# =========================================================================
# 6S AUDIT (Sort, Set in Order, Shine, Standardize, Sustain, Safety)
# =========================================================================

class SixSCategory(str, enum.Enum):
    SORT = "sort"
    SET_IN_ORDER = "set_in_order"
    SHINE = "shine"
    STANDARDIZE = "standardize"
    SUSTAIN = "sustain"
    SAFETY = "safety"


class SixSAudit(TimestampMixin, Base):
    __tablename__ = "six_s_audits"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    audit_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    area_name = Column(String, nullable=False)
    overall_score = Column(Float)  # 0-100, auto-calculated
    maturity_level = Column(Integer)  # 1-5 maturity scale
    notes = Column(Text)
    photo_urls = Column(JSON, default=list)  # Evidence photos

    items = relationship("SixSAuditItem", back_populates="audit", cascade="all, delete-orphan")


class SixSAuditItem(TimestampMixin, Base):
    __tablename__ = "six_s_audit_items"

    audit_id = Column(Integer, ForeignKey("six_s_audits.id"), nullable=False)
    category = Column(String, nullable=False)
    question = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)  # 1-5 rating
    finding = Column(Text)
    corrective_action = Column(Text)
    responsible = Column(String)
    due_date = Column(DateTime(timezone=True))
    is_resolved = Column(Boolean, default=False)

    # Phase 2 enhancements
    photo_url = Column(String, nullable=True)  # photo evidence per item

    audit = relationship("SixSAudit", back_populates="items")


# =========================================================================
# VALUE STREAM MAPPING (VSM)
# =========================================================================

class VSMMap(TimestampMixin, Base):
    __tablename__ = "vsm_maps"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    product_family = Column(String, nullable=False)
    map_type = Column(String, default="current")  # current, future
    takt_time_sec = Column(Float)
    total_lead_time_days = Column(Float)
    total_processing_time_min = Column(Float)
    pce_ratio = Column(Float)  # Process Cycle Efficiency = processing / lead
    customer_demand_per_day = Column(Integer)
    notes = Column(Text)

    # Phase 2 enhancements
    supplier_name = Column(String, nullable=True)
    customer_name = Column(String, nullable=True)

    steps = relationship("VSMStep", back_populates="vsm_map", order_by="VSMStep.step_order", cascade="all, delete-orphan")


class VSMStep(TimestampMixin, Base):
    __tablename__ = "vsm_steps"

    vsm_map_id = Column(Integer, ForeignKey("vsm_maps.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    process_name = Column(String, nullable=False)
    cycle_time_sec = Column(Float)
    changeover_time_min = Column(Float)
    uptime_pct = Column(Float)  # 0-100
    operators = Column(Integer)
    wip_before = Column(Integer)  # Work-in-progress inventory before this step
    wait_time_hours = Column(Float)
    is_bottleneck = Column(Boolean, default=False)
    is_kaizen_burst = Column(Boolean, default=False)  # Marked for improvement
    notes = Column(Text)

    # Phase 2 enhancements
    step_type = Column(String, default="process")  # process, inventory, info_flow, push, pull, kaizen_burst
    value_add = Column(Boolean, default=True)       # value-add vs non-value-add

    vsm_map = relationship("VSMMap", back_populates="steps")


# =========================================================================
# A3 REPORT (Problem Solving on A3 Paper)
# =========================================================================

class A3Status(str, enum.Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"


class A3Report(TimestampMixin, Base):
    __tablename__ = "a3_reports"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sponsor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String, nullable=False)
    status = Column(String, default="draft")

    # Left side of A3
    background = Column(Text)
    current_condition = Column(Text)
    goal_statement = Column(Text)
    root_cause_analysis = Column(Text)

    # Right side of A3
    countermeasures = Column(Text)
    implementation_plan = Column(Text)
    follow_up = Column(Text)
    results = Column(Text)

    # Mentor review
    mentor_name = Column(String, nullable=True)
    mentor_date = Column(String, nullable=True)
    mentor_feedback = Column(Text, nullable=True)
    mentor_status = Column(String, nullable=True, default="draft")  # draft, reviewed, approved

    # Links to other analyses
    five_why_id = Column(Integer, ForeignKey("five_why_analyses.id"), nullable=True)
    ishikawa_id = Column(Integer, ForeignKey("ishikawa_analyses.id"), nullable=True)

    target_date = Column(DateTime(timezone=True))
    completion_date = Column(DateTime(timezone=True))


# =========================================================================
# GEMBA WALK
# =========================================================================

class GembaWalk(TimestampMixin, Base):
    __tablename__ = "gemba_walks"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    walker_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    walk_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    area = Column(String, nullable=False)
    duration_min = Column(Integer)
    theme = Column(String)  # safety, quality, productivity, 5s, flow
    summary = Column(Text)

    # Phase 2 enhancements
    route_id = Column(Integer, nullable=True)    # standard route
    route_name = Column(String, nullable=True)   # standard route name

    observations = relationship("GembaObservation", back_populates="walk", cascade="all, delete-orphan")


class GembaObservation(TimestampMixin, Base):
    __tablename__ = "gemba_observations"

    walk_id = Column(Integer, ForeignKey("gemba_walks.id"), nullable=False)
    observation_type = Column(String, nullable=False)  # positive, concern, idea, safety
    description = Column(Text, nullable=False)
    location = Column(String)
    photo_url = Column(String)
    action_required = Column(Boolean, default=False)
    assigned_to = Column(String)
    due_date = Column(DateTime(timezone=True))
    status = Column(String, default="open")  # open, in_progress, closed
    priority = Column(String, default="medium")  # low, medium, high, critical

    # Phase 2 enhancements
    linked_kaizen_id = Column(Integer, ForeignKey("kaizen_items.id"), nullable=True)  # auto-Kaizen

    walk = relationship("GembaWalk", back_populates="observations")


# =========================================================================
# TPM - Total Productive Maintenance
# =========================================================================

class TPMPillar(str, enum.Enum):
    AUTONOMOUS_MAINTENANCE = "autonomous_maintenance"
    PLANNED_MAINTENANCE = "planned_maintenance"
    FOCUSED_IMPROVEMENT = "focused_improvement"
    QUALITY_MAINTENANCE = "quality_maintenance"
    EARLY_EQUIPMENT_MANAGEMENT = "early_equipment_management"
    TRAINING = "training"
    SAFETY = "safety"
    OFFICE_TPM = "office_tpm"


class TPMEquipment(TimestampMixin, Base):
    __tablename__ = "tpm_equipment"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)

    name = Column(String, nullable=False)
    equipment_code = Column(String)
    location = Column(String)
    criticality = Column(String, default="medium")  # low, medium, high, critical
    mtbf_hours = Column(Float)  # Mean Time Between Failures
    mttr_hours = Column(Float)  # Mean Time To Repair
    maintenance_interval_days = Column(Integer, default=30)  # PM interval in days
    last_maintenance_date = Column(DateTime(timezone=True))
    next_planned_maintenance = Column(DateTime(timezone=True))


class TPMMaintenanceRecord(TimestampMixin, Base):
    __tablename__ = "tpm_maintenance_records"

    equipment_id = Column(Integer, ForeignKey("tpm_equipment.id"), nullable=False)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    maintenance_type = Column(String, nullable=False)  # autonomous, planned, corrective, predictive
    pillar = Column(String)
    description = Column(Text, nullable=False)
    duration_min = Column(Integer)
    date_performed = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    parts_replaced = Column(JSON, default=list)
    cost_eur = Column(Float)
    findings = Column(Text)
    next_action = Column(Text)


# =========================================================================
# CILT - Cleaning, Inspection, Lubrication, Tightening
# =========================================================================

class CILTFrequency(str, enum.Enum):
    EVERY_SHIFT = "every_shift"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class CILTStandard(TimestampMixin, Base):
    """Template for CILT checks on a specific equipment/area."""
    __tablename__ = "cilt_standards"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("tpm_equipment.id"), nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)

    name = Column(String, nullable=False)
    area = Column(String)
    frequency = Column(String, default="daily")
    estimated_time_min = Column(Integer)

    items = relationship("CILTItem", back_populates="standard", order_by="CILTItem.item_order", cascade="all, delete-orphan")


class CILTCategory(str, enum.Enum):
    CLEANING = "cleaning"
    INSPECTION = "inspection"
    LUBRICATION = "lubrication"
    TIGHTENING = "tightening"


class CILTItem(TimestampMixin, Base):
    """Individual check point within a CILT standard."""
    __tablename__ = "cilt_items"

    standard_id = Column(Integer, ForeignKey("cilt_standards.id"), nullable=False)
    item_order = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    method = Column(String)  # visual, manual, tool, gauge
    standard_value = Column(String)  # e.g. "10 Nm", "clean", "level OK"
    tool_required = Column(String)  # e.g. "torque wrench", "oil can"
    time_seconds = Column(Integer)
    photo_reference_url = Column(String)

    standard = relationship("CILTStandard", back_populates="items")


class CILTExecution(TimestampMixin, Base):
    """A completed CILT round."""
    __tablename__ = "cilt_executions"

    standard_id = Column(Integer, ForeignKey("cilt_standards.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    execution_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    shift = Column(String)  # morning, afternoon, night
    duration_min = Column(Integer)
    all_ok = Column(Boolean, default=True)
    notes = Column(Text)

    checks = relationship("CILTCheck", back_populates="execution", cascade="all, delete-orphan")


class CILTCheck(TimestampMixin, Base):
    """Individual item result within a CILT execution."""
    __tablename__ = "cilt_checks"

    execution_id = Column(Integer, ForeignKey("cilt_executions.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("cilt_items.id"), nullable=False)

    status = Column(String, nullable=False)  # ok, nok, skipped
    measured_value = Column(String)
    anomaly_description = Column(Text)
    photo_url = Column(String)
    work_order_created = Column(Boolean, default=False)

    execution = relationship("CILTExecution", back_populates="checks")


# =========================================================================
# ANDON BOARD - Real-time Line Status
# =========================================================================

class AndonStatus(str, enum.Enum):
    GREEN = "green"      # Running normally
    YELLOW = "yellow"    # Warning / slow
    RED = "red"          # Stopped
    BLUE = "blue"        # Maintenance needed


class AndonEvent(TimestampMixin, Base):
    __tablename__ = "andon_events"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    triggered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    status = Column(String, nullable=False)
    reason = Column(String)
    description = Column(Text)
    triggered_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True))
    resolution_time_min = Column(Float)
    escalated = Column(Boolean, default=False)

    # Escalation tracking
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    escalation_count = Column(Integer, default=0)

    # QC integration (Phase 1)
    source = Column(String, nullable=True)  # "manual", "qc_check", "auto"
    qc_record_id = Column(Integer, ForeignKey("qc_records.id"), nullable=True)
    trigger_type = Column(String, nullable=True)  # "line_clearance_fail", "fga_fail", etc.


# =========================================================================
# HOURLY PRODUCTION TRACKING (Redzone-style)
# =========================================================================

class HourlyProduction(TimestampMixin, Base):
    """Hour-by-hour production tracking with target vs actual."""
    __tablename__ = "hourly_production"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)
    hour = Column(Integer, nullable=False)  # 0-23
    shift = Column(String)

    target_pieces = Column(Integer, nullable=False)
    actual_pieces = Column(Integer, nullable=False)
    scrap_pieces = Column(Integer, default=0)
    downtime_min = Column(Float, default=0)
    is_win = Column(Boolean)  # actual >= target = green, else red
    notes = Column(String)
