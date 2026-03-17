"""Pydantic schemas for Quality Control models."""

from pydantic import BaseModel, field_validator
from datetime import datetime


def _lower(v):
    """Normalize enum string values to lowercase (handles UPPERCASE from PostgreSQL)."""
    if isinstance(v, str):
        return v.lower()
    if hasattr(v, 'value'):
        return v.value
    return v


# ─── Defect Catalog ───────────────────────────────────────────────────────────


class DefectCatalogCreate(BaseModel):
    product_id: int | None = None
    production_line_id: int | None = None
    code: str
    name: str
    severity: str = "minor"  # minor, major, critical
    category: str | None = None
    is_active: bool = True
    sort_order: int = 0


class DefectCatalogUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    severity: str | None = None
    category: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class DefectCatalogResponse(BaseModel):
    id: int
    factory_id: int
    product_id: int | None
    production_line_id: int | None
    code: str
    name: str
    severity: str
    category: str | None
    is_active: bool
    sort_order: int
    created_at: datetime

    @field_validator("severity", mode="before")
    @classmethod
    def normalize_severity(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# ─── QC Template ──────────────────────────────────────────────────────────────


class QCTemplateItemCreate(BaseModel):
    item_order: int
    category: str | None = None
    check_type: str = "checkbox"
    description: str
    specification: str | None = None
    lower_limit: float | None = None
    upper_limit: float | None = None
    unit: str | None = None
    is_critical: bool = False
    is_mandatory: bool = True


class QCTemplateItemResponse(BaseModel):
    id: int
    item_order: int
    category: str | None
    check_type: str
    description: str
    specification: str | None
    lower_limit: float | None
    upper_limit: float | None
    unit: str | None
    is_critical: bool
    is_mandatory: bool

    @field_validator("check_type", mode="before")
    @classmethod
    def normalize_check_type(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


class QCTemplateCreate(BaseModel):
    product_id: int | None = None
    production_line_id: int | None = None
    work_center_id: int | None = None
    name: str
    template_type: str  # line_clearance, fga, pre_production_audit, in_process, final_inspection
    version: str = "1.0"
    estimated_time_min: int | None = None
    description: str | None = None
    pass_threshold_pct: float = 100.0
    critical_items_must_pass: bool = True
    items: list[QCTemplateItemCreate] = []


class QCTemplateResponse(BaseModel):
    id: int
    factory_id: int
    product_id: int | None
    production_line_id: int | None
    work_center_id: int | None
    name: str
    template_type: str
    version: str
    is_active: bool
    estimated_time_min: int | None
    description: str | None
    pass_threshold_pct: float
    critical_items_must_pass: bool
    items: list[QCTemplateItemResponse] = []
    created_at: datetime

    @field_validator("template_type", mode="before")
    @classmethod
    def normalize_template_type(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# ─── QC Record ────────────────────────────────────────────────────────────────


class QCRecordCreate(BaseModel):
    template_id: int
    production_order_id: int | None = None
    production_line_id: int
    production_record_id: int | None = None
    check_type: str
    sample_size: int | None = None
    sample_number: int | None = None
    notes: str | None = None


class QCCheckResultCreate(BaseModel):
    template_item_id: int
    result: str  # pass, fail, na, skipped
    measured_value: float | None = None
    text_value: str | None = None
    notes: str | None = None
    defect_catalog_id: int | None = None


class QCCheckResultResponse(BaseModel):
    id: int
    template_item_id: int
    result: str
    measured_value: float | None
    text_value: str | None
    notes: str | None
    defect_catalog_id: int | None

    @field_validator("result", mode="before")
    @classmethod
    def normalize_result(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


class QCRecordResponse(BaseModel):
    id: int
    factory_id: int
    template_id: int
    production_order_id: int | None
    production_line_id: int
    performed_by_id: int
    check_type: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    overall_score_pct: float | None
    andon_triggered: bool | None = False
    hold_placed: bool | None = False
    sample_size: int | None
    sample_number: int | None
    notes: str | None
    results: list[QCCheckResultResponse] = []
    created_at: datetime

    @field_validator("check_type", "status", mode="before")
    @classmethod
    def normalize_enum(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# ─── NCR ──────────────────────────────────────────────────────────────────────


class NCRCreate(BaseModel):
    production_line_id: int | None = None
    production_order_id: int | None = None
    qc_record_id: int | None = None
    product_id: int | None = None
    defect_catalog_id: int | None = None
    title: str
    description: str
    severity: str  # minor, major, critical
    quantity_affected: int | None = None


class NCRUpdate(BaseModel):
    status: str | None = None
    assigned_to_id: int | None = None
    disposition: str | None = None
    disposition_notes: str | None = None
    root_cause: str | None = None


class NCRResponse(BaseModel):
    id: int
    factory_id: int
    ncr_number: str
    title: str
    description: str
    severity: str
    status: str
    production_line_id: int | None
    production_order_id: int | None
    qc_record_id: int | None
    product_id: int | None
    quantity_affected: int | None
    disposition: str | None
    disposition_notes: str | None
    root_cause: str | None
    detected_at: datetime
    closed_at: datetime | None
    created_at: datetime

    @field_validator("severity", "status", "disposition", mode="before")
    @classmethod
    def normalize_enum(cls, v):
        return _lower(v) if v is not None else v

    class Config:
        from_attributes = True


# ─── CAPA ─────────────────────────────────────────────────────────────────────


class CAPACreate(BaseModel):
    ncr_id: int | None = None
    production_line_id: int | None = None
    capa_type: str  # corrective, preventive
    title: str
    description: str
    root_cause: str | None = None
    priority: str = "medium"
    owner_id: int | None = None
    due_date: datetime | None = None


class CAPAUpdate(BaseModel):
    status: str | None = None
    owner_id: int | None = None
    root_cause: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    effectiveness_result: str | None = None


class CAPAResponse(BaseModel):
    id: int
    factory_id: int
    capa_number: str
    capa_type: str
    title: str
    description: str
    root_cause: str | None
    status: str
    priority: str
    ncr_id: int | None
    owner_id: int | None
    due_date: datetime | None
    implemented_at: datetime | None
    verified_at: datetime | None
    effectiveness_result: str | None
    created_at: datetime

    @field_validator("capa_type", "status", "priority", mode="before")
    @classmethod
    def normalize_enum(cls, v):
        return _lower(v) if v is not None else v

    class Config:
        from_attributes = True
