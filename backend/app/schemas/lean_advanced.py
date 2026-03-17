from pydantic import BaseModel, field_validator
from datetime import datetime


def _lower(v):
    """Normalize enum string values to lowercase (handles UPPERCASE from PostgreSQL)."""
    if isinstance(v, str):
        return v.lower()
    if hasattr(v, 'value'):
        return v.value
    return v


# --- 6S AUDIT ---

class SixSAuditItemCreate(BaseModel):
    category: str
    question: str
    score: int  # 1-5
    finding: str | None = None
    corrective_action: str | None = None
    responsible: str | None = None
    due_date: datetime | None = None


class SixSAuditCreate(BaseModel):
    production_line_id: int | None = None
    area_name: str
    notes: str | None = None
    items: list[SixSAuditItemCreate] = []


class SixSAuditItemResponse(BaseModel):
    id: int
    category: str
    question: str
    score: int
    finding: str | None = None
    corrective_action: str | None = None
    responsible: str | None = None
    due_date: datetime | None = None

    class Config:
        from_attributes = True


class SixSAuditResponse(BaseModel):
    id: int
    area_name: str
    overall_score: float | None
    maturity_level: int | None
    audit_date: datetime
    notes: str | None
    items: list[SixSAuditItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- VSM ---

class VSMStepCreate(BaseModel):
    step_order: int
    process_name: str
    cycle_time_sec: float | None = None
    changeover_time_min: float | None = None
    uptime_pct: float | None = None
    operators: int | None = None
    wip_before: int | None = None
    wait_time_hours: float | None = None
    is_bottleneck: bool = False
    is_kaizen_burst: bool = False
    notes: str | None = None


class VSMCreate(BaseModel):
    title: str
    product_family: str
    map_type: str = "current"
    takt_time_sec: float | None = None
    customer_demand_per_day: int | None = None
    notes: str | None = None
    steps: list[VSMStepCreate] = []


class VSMStepResponse(BaseModel):
    id: int
    step_order: int
    process_name: str
    cycle_time_sec: float | None = None
    changeover_time_min: float | None = None
    uptime_pct: float | None = None
    operators: int | None = None
    wip_before: int | None = None
    wait_time_hours: float | None = None
    is_bottleneck: bool = False
    is_kaizen_burst: bool = False
    notes: str | None = None

    class Config:
        from_attributes = True


class VSMResponse(BaseModel):
    id: int
    title: str
    product_family: str
    map_type: str
    takt_time_sec: float | None
    total_lead_time_days: float | None
    total_processing_time_min: float | None
    pce_ratio: float | None
    steps: list[VSMStepResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- A3 REPORT ---

class A3ReportCreate(BaseModel):
    title: str
    background: str | None = None
    current_condition: str | None = None
    goal_statement: str | None = None
    root_cause_analysis: str | None = None
    countermeasures: str | None = None
    implementation_plan: str | None = None
    follow_up: str | None = None
    results: str | None = None
    target_date: datetime | None = None
    five_why_id: int | None = None
    ishikawa_id: int | None = None
    # Mentor review fields
    mentor_name: str | None = None
    mentor_date: str | None = None
    mentor_feedback: str | None = None
    mentor_status: str | None = None


class A3ReportResponse(BaseModel):
    id: int
    title: str
    status: str
    background: str | None
    current_condition: str | None
    goal_statement: str | None
    root_cause_analysis: str | None
    countermeasures: str | None
    implementation_plan: str | None
    follow_up: str | None
    results: str | None
    target_date: datetime | None
    # Mentor review fields
    mentor_name: str | None = None
    mentor_date: str | None = None
    mentor_feedback: str | None = None
    mentor_status: str | None = None
    created_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# --- GEMBA WALK ---

class GembaObservationCreate(BaseModel):
    observation_type: str  # positive, concern, idea, safety
    description: str
    location: str | None = None
    action_required: bool = False
    assigned_to: str | None = None
    due_date: datetime | None = None
    priority: str = "medium"


class GembaWalkCreate(BaseModel):
    area: str
    duration_min: int | None = None
    theme: str | None = None
    summary: str | None = None
    observations: list[GembaObservationCreate] = []


class GembaObservationResponse(BaseModel):
    id: int
    observation_type: str
    description: str
    location: str | None = None
    action_required: bool = False
    assigned_to: str | None = None
    due_date: datetime | None = None
    priority: str = "medium"

    class Config:
        from_attributes = True


class GembaWalkResponse(BaseModel):
    id: int
    area: str
    walk_date: datetime
    duration_min: int | None
    theme: str | None
    summary: str | None
    observations: list[GembaObservationResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- TPM ---

class TPMEquipmentCreate(BaseModel):
    production_line_id: int | None = None
    name: str
    equipment_code: str | None = None
    location: str | None = None
    criticality: str = "medium"
    mtbf_hours: float | None = None
    mttr_hours: float | None = None
    maintenance_interval_days: int = 30


class TPMMaintenanceCreate(BaseModel):
    equipment_id: int
    maintenance_type: str
    pillar: str | None = None
    description: str
    duration_min: int | None = None
    parts_replaced: list[str] = []
    cost_eur: float | None = None
    findings: str | None = None
    next_action: str | None = None


# --- CILT ---

class CILTItemCreate(BaseModel):
    item_order: int
    category: str  # cleaning, inspection, lubrication, tightening
    description: str
    method: str | None = None
    standard_value: str | None = None
    tool_required: str | None = None
    time_seconds: int | None = None


class CILTStandardCreate(BaseModel):
    equipment_id: int | None = None
    production_line_id: int | None = None
    name: str
    area: str | None = None
    frequency: str = "daily"
    estimated_time_min: int | None = None
    items: list[CILTItemCreate] = []


class CILTCheckCreate(BaseModel):
    item_id: int
    status: str  # ok, nok, skipped
    measured_value: str | None = None
    anomaly_description: str | None = None


class CILTExecutionCreate(BaseModel):
    standard_id: int
    shift: str | None = None
    duration_min: int | None = None
    notes: str | None = None
    checks: list[CILTCheckCreate] = []


# --- ANDON ---

class AndonEventCreate(BaseModel):
    production_line_id: int
    status: str  # green, yellow, red, blue
    reason: str | None = None
    description: str | None = None


class AndonResolve(BaseModel):
    resolution_notes: str | None = None


# --- HOURLY PRODUCTION ---

class HourlyProductionCreate(BaseModel):
    production_line_id: int
    date: datetime
    hour: int
    shift: str | None = None
    target_pieces: int
    actual_pieces: int
    scrap_pieces: int = 0
    downtime_min: float = 0
    notes: str | None = None
