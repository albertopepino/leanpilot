"""Pydantic schemas for Manufacturing Tree models."""

from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


def _lower(v):
    """Normalize enum string values to lowercase (handles UPPERCASE from PostgreSQL)."""
    if isinstance(v, str):
        return v.lower()
    if hasattr(v, 'value'):
        return v.value
    return v


# ─── Work Center ──────────────────────────────────────────────────────────────


class WorkCenterCreate(BaseModel):
    production_line_id: int
    name: str
    description: str | None = None
    machine_type: str | None = None
    capacity_units_per_hour: float | None = None
    is_active: bool = True


class WorkCenterUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    machine_type: str | None = None
    capacity_units_per_hour: float | None = None
    is_active: bool | None = None


class WorkCenterResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: int
    name: str
    description: str | None
    machine_type: str | None
    capacity_units_per_hour: float | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Product ──────────────────────────────────────────────────────────────────


class ProductCreate(BaseModel):
    code: str
    name: str
    description: str | None = None
    unit_of_measure: str = "pcs"
    product_family: str | None = None
    labor_minutes_per_unit: float | None = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    description: str | None = None
    unit_of_measure: str | None = None
    product_family: str | None = None
    labor_minutes_per_unit: float | None = None
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: int
    factory_id: int
    code: str
    name: str
    description: str | None
    unit_of_measure: str | None
    product_family: str | None
    labor_minutes_per_unit: float | None = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── BOM ──────────────────────────────────────────────────────────────────────


class BOMComponentCreate(BaseModel):
    sequence: int = 0
    material_code: str | None = None
    material_name: str
    quantity_per_unit: float
    unit_of_measure: str | None = None
    is_critical: bool = False
    notes: str | None = None


class BOMComponentResponse(BaseModel):
    id: int
    sequence: int
    material_code: str | None
    material_name: str
    quantity_per_unit: float
    unit_of_measure: str | None
    is_critical: bool
    notes: str | None

    class Config:
        from_attributes = True


class BOMOperationCreate(BaseModel):
    sequence: int = 0
    work_center_id: int | None = None
    operation_name: str
    cycle_time_seconds: float
    cycle_time_basis: str = "per_piece"  # "per_piece" or "per_100"
    labor_minutes: float | None = None
    notes: str | None = None


class BOMOperationResponse(BaseModel):
    id: int
    sequence: int
    work_center_id: int | None
    operation_name: str
    cycle_time_seconds: float
    cycle_time_basis: str
    labor_minutes: float | None
    notes: str | None

    class Config:
        from_attributes = True


class BOMCreate(BaseModel):
    product_id: int
    production_line_id: int
    version: str = "1.0"
    ideal_cycle_time_sec: float
    batch_size: int | None = None
    notes: str | None = None
    components: list[BOMComponentCreate] = []
    operations: list[BOMOperationCreate] = []


class BOMUpdate(BaseModel):
    version: str | None = None
    ideal_cycle_time_sec: float | None = None
    batch_size: int | None = None
    is_active: bool | None = None
    notes: str | None = None


class BOMResponse(BaseModel):
    id: int
    factory_id: int
    product_id: int
    production_line_id: int
    version: str
    is_active: bool
    ideal_cycle_time_sec: float
    batch_size: int | None
    approved_by_id: int | None
    approved_at: datetime | None
    notes: str | None
    components: list[BOMComponentResponse] = []
    operations: list[BOMOperationResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Production Order ────────────────────────────────────────────────────────


class ProductionOrderLineCreate(BaseModel):
    production_line_id: int
    bom_id: int | None = None
    planned_quantity: int
    notes: str | None = None


class ProductionOrderLineResponse(BaseModel):
    id: int
    production_line_id: int
    bom_id: int | None
    planned_quantity: int
    actual_quantity_good: int
    actual_quantity_scrap: int
    status: str
    notes: str | None
    line_name: str | None = None

    class Config:
        from_attributes = True


class ProductionOrderCreate(BaseModel):
    production_line_id: int  # primary line (kept for backward compat)
    product_id: int
    bom_id: int | None = None
    order_number: str | None = None  # auto-generated if not provided
    planned_quantity: int
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    customer_ref: str | None = None
    batch_lot_number: str | None = None
    notes: str | None = None
    order_lines: list[ProductionOrderLineCreate] = []  # multi-line support

    @field_validator("planned_start", "planned_end", mode="before")
    @classmethod
    def parse_date_string(cls, v):
        if isinstance(v, str) and "T" not in v and " " not in v:
            return datetime.fromisoformat(v + "T00:00:00")
        return v


class ProductionOrderUpdate(BaseModel):
    planned_quantity: int | None = None
    planned_start: datetime | None = None
    planned_end: datetime | None = None
    customer_ref: str | None = None
    batch_lot_number: str | None = None
    notes: str | None = None
    bom_id: int | None = None

    @field_validator("planned_start", "planned_end", mode="before")
    @classmethod
    def parse_date_string(cls, v):
        if isinstance(v, str) and "T" not in v and " " not in v:
            return datetime.fromisoformat(v + "T00:00:00")
        return v


class ProductionOrderResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: int
    product_id: int
    bom_id: int | None
    order_number: str
    status: str
    planned_quantity: int
    actual_quantity_good: int
    actual_quantity_scrap: int
    planned_start: datetime | None
    planned_end: datetime | None
    actual_start: datetime | None
    actual_end: datetime | None
    customer_ref: str | None
    batch_lot_number: str | None = None
    notes: str | None
    qc_hold: bool | None = False
    qc_hold_reason: str | None
    created_at: datetime

    # Multi-line support
    order_lines: list[ProductionOrderLineResponse] = []

    # Enriched fields (populated in route)
    product_name: str | None = None
    line_name: str | None = None
    progress_pct: float | None = None

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        return _lower(v) if v is not None else v

    class Config:
        from_attributes = True


class POProductivitySummary(BaseModel):
    """Aggregated productivity data for a single PO."""
    order_id: int
    order_number: str
    product_name: str
    line_name: str
    status: str
    planned_quantity: int
    actual_quantity_good: int
    actual_quantity_scrap: int
    progress_pct: float
    oee: float | None = None
    first_pass_yield: float | None = None
    scrap_rate: float | None = None
    planned_vs_actual_hours: dict | None = None
    top_defects: list[dict] = []
