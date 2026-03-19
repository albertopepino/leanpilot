"""
Quality Control Models
──────────────────────
DefectCatalog, QCTemplate, QCTemplateItem, QCRecord, QCCheckResult,
NonConformanceReport, CAPAAction

These power the full QC chain:
  QC Template → QC Check → Pass/Fail → Andon trigger → NCR → CAPA → Kaizen
"""

from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey, DateTime, Text,
    Boolean, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


# ─── Enums ────────────────────────────────────────────────────────────────────


class DefectSeverity(str, enum.Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


class QCCheckType(str, enum.Enum):
    LINE_CLEARANCE = "line_clearance"
    FGA = "fga"
    PRE_PRODUCTION_AUDIT = "pre_production_audit"
    IN_PROCESS = "in_process"
    FINAL_INSPECTION = "final_inspection"


class QCItemCheckType(str, enum.Enum):
    CHECKBOX = "checkbox"
    MEASUREMENT = "measurement"
    TEXT = "text"
    PHOTO = "photo"


class QCRecordStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    PASSED_WITH_DEVIATIONS = "passed_with_deviations"
    FAILED = "failed"
    VOIDED = "voided"


class QCCheckResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    NA = "na"
    SKIPPED = "skipped"


class NCRStatus(str, enum.Enum):
    OPEN = "open"
    UNDER_INVESTIGATION = "under_investigation"
    PENDING_CAPA = "pending_capa"
    CLOSED = "closed"
    REJECTED = "rejected"


class NCRDisposition(str, enum.Enum):
    REWORK = "rework"
    SCRAP = "scrap"
    USE_AS_IS = "use_as_is"
    RETURN_TO_SUPPLIER = "return_to_supplier"


class CAPAType(str, enum.Enum):
    CORRECTIVE = "corrective"
    PREVENTIVE = "preventive"


class CAPAStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    IMPLEMENTED = "implemented"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class CAPAPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ─── Defect Catalog ──────────────────────────────────────────────────────────


class DefectCatalog(TimestampMixin, Base):
    """
    Factory-configurable defect types.
    Replaces the hardcoded DEFECT_TYPES in the frontend.
    Can be scoped to a specific product and/or line, or factory-wide (null).
    """
    __tablename__ = "defect_catalog"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)

    code = Column(String, nullable=False)  # e.g. "DIM-001"
    name = Column(String, nullable=False)  # e.g. "Out of tolerance"
    severity = Column(String, default="minor")
    category = Column(String)  # dimensional, surface, assembly, material, contamination, packaging
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


# ─── QC Templates ────────────────────────────────────────────────────────────


class QCTemplate(TimestampMixin, Base):
    """
    Reusable QC checklist definition.
    Can be scoped to product/line/work-center or factory-wide.
    """
    __tablename__ = "qc_templates"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    work_center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    template_type = Column(String, nullable=False)
    version = Column(String, default="1.0")
    is_active = Column(Boolean, default=True)
    estimated_time_min = Column(Integer)
    description = Column(Text)
    pass_threshold_pct = Column(Float, default=100.0)
    critical_items_must_pass = Column(Boolean, default=True)

    items = relationship("QCTemplateItem", back_populates="template", cascade="all, delete-orphan")


class QCTemplateItem(TimestampMixin, Base):
    """Individual check point within a QC template."""
    __tablename__ = "qc_template_items"

    template_id = Column(Integer, ForeignKey("qc_templates.id"), nullable=False)

    item_order = Column(Integer, nullable=False)
    category = Column(String)  # cleanliness, materials, tooling, settings, documentation, measurement
    check_type = Column(String, default="checkbox")
    description = Column(Text, nullable=False)
    specification = Column(Text)  # expected value or standard
    lower_limit = Column(Float, nullable=True)  # LSL for measurement checks
    upper_limit = Column(Float, nullable=True)  # USL for measurement checks
    unit = Column(String, nullable=True)  # mm, kg, degrees C
    is_critical = Column(Boolean, default=False)  # failure triggers RED Andon
    is_mandatory = Column(Boolean, default=True)
    reference_photo_url = Column(String, nullable=True)

    template = relationship("QCTemplate", back_populates="items")


# ─── QC Records (executed checks) ────────────────────────────────────────────


class QCRecord(TimestampMixin, Base):
    """An executed QC check session — one instantiation of a template."""
    __tablename__ = "qc_records"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("qc_templates.id"), nullable=False)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    production_record_id = Column(Integer, ForeignKey("production_records.id"), nullable=True)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    check_type = Column(String, nullable=False)
    status = Column(String, default="in_progress")
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    overall_score_pct = Column(Float, nullable=True)

    # Andon integration
    andon_triggered = Column(Boolean, default=False)
    andon_event_id = Column(Integer, ForeignKey("andon_events.id"), nullable=True)

    # Hold management
    hold_placed = Column(Boolean, default=False)
    hold_released_at = Column(DateTime(timezone=True), nullable=True)
    hold_released_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    hold_release_notes = Column(Text, nullable=True)

    notes = Column(Text)
    sample_size = Column(Integer, nullable=True)
    sample_number = Column(Integer, nullable=True)

    results = relationship("QCCheckResultRecord", back_populates="qc_record", cascade="all, delete-orphan")
    template = relationship("QCTemplate")


class QCCheckResultRecord(TimestampMixin, Base):
    """Individual item result within a QC record execution."""
    __tablename__ = "qc_check_results"

    qc_record_id = Column(Integer, ForeignKey("qc_records.id"), nullable=False)
    template_item_id = Column(Integer, ForeignKey("qc_template_items.id"), nullable=False)

    result = Column(String, nullable=False)
    measured_value = Column(Float, nullable=True)
    text_value = Column(Text, nullable=True)
    photo_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    defect_catalog_id = Column(Integer, ForeignKey("defect_catalog.id"), nullable=True)

    qc_record = relationship("QCRecord", back_populates="results")
    template_item = relationship("QCTemplateItem")


# ─── Non-Conformance Report ──────────────────────────────────────────────────


class NonConformanceReport(TimestampMixin, Base):
    """
    Formal NCR raised when a QC check fails or a defect is discovered.
    Can link to QC record or be raised manually.
    """
    __tablename__ = "non_conformance_reports"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    qc_record_id = Column(Integer, ForeignKey("qc_records.id"), nullable=True)
    raised_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    defect_catalog_id = Column(Integer, ForeignKey("defect_catalog.id"), nullable=True)
    five_why_id = Column(Integer, ForeignKey("five_why_analyses.id"), nullable=True)
    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    ncr_number = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String, nullable=False)
    status = Column(String, default="open")

    detected_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    quantity_affected = Column(Integer, nullable=True)
    batch_lot_number = Column(String, nullable=True)
    disposition = Column(String, nullable=True)
    disposition_notes = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)


# ─── CAPA ─────────────────────────────────────────────────────────────────────


class CAPAAction(TimestampMixin, Base):
    """
    Corrective and Preventive Action linked to NCR.
    Can also link to Kaizen items for continuous improvement.
    """
    __tablename__ = "capa_actions"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    ncr_id = Column(Integer, ForeignKey("non_conformance_reports.id"), nullable=True)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    kaizen_item_id = Column(Integer, ForeignKey("kaizen_items.id"), nullable=True)

    capa_number = Column(String, nullable=False, index=True)
    capa_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    root_cause = Column(Text, nullable=True)

    status = Column(String, default="open")
    priority = Column(String, default="medium")

    due_date = Column(DateTime(timezone=True), nullable=True)
    implemented_at = Column(DateTime(timezone=True), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)

    effectiveness_check_date = Column(DateTime(timezone=True), nullable=True)
    effectiveness_result = Column(Text, nullable=True)


# ─── QC Policy Documents ────────────────────────────────────────────────────


class QCPolicyDocument(TimestampMixin, Base):
    """
    Repository of QC policy documents (PDF, Word, JPEG).
    Stores file metadata; actual files stored on disk.
    """
    __tablename__ = "qc_policy_documents"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)  # policy, procedure, work_instruction, form, reference
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # relative path on disk
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String, nullable=False)
    version = Column(String, default="1.0")
    is_active = Column(Boolean, default=True)
