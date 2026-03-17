from pydantic import BaseModel, field_validator
from datetime import datetime


def _lower(v):
    """Normalize enum string values to lowercase (handles UPPERCASE from PostgreSQL)."""
    if isinstance(v, str):
        return v.lower()
    if hasattr(v, 'value'):
        return v.value
    return v


# --- OEE ---

class OEEResponse(BaseModel):
    id: int
    production_line_id: int
    date: datetime
    availability: float
    performance: float
    quality: float
    oee: float
    planned_time_min: float | None
    run_time_min: float | None
    total_pieces: int | None
    good_pieces: int | None
    downtime_min: float | None

    class Config:
        from_attributes = True


class OEESummary(BaseModel):
    line_id: int
    line_name: str
    current_oee: float
    target_oee: float
    availability: float
    performance: float
    quality: float
    trend: str  # "up", "down", "stable"
    period_start: datetime
    period_end: datetime


# --- 5 WHY ---

class FiveWhyStepCreate(BaseModel):
    step_number: int
    why_question: str
    answer: str


class FiveWhyStepResponse(BaseModel):
    id: int
    step_number: int
    why_question: str
    answer: str

    class Config:
        from_attributes = True


class FiveWhyCreate(BaseModel):
    production_line_id: int | None = None
    title: str
    problem_statement: str
    steps: list[FiveWhyStepCreate] = []
    countermeasure: str | None = None
    responsible: str | None = None
    due_date: datetime | None = None


class FiveWhyResponse(BaseModel):
    id: int
    title: str
    problem_statement: str
    status: str
    root_cause: str | None
    countermeasure: str | None
    responsible: str | None
    due_date: datetime | None
    ai_generated: bool | None = False
    steps: list[FiveWhyStepResponse] = []
    created_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# --- ISHIKAWA ---

class IshikawaCauseCreate(BaseModel):
    category: str  # man, machine, method, material, measurement, environment
    cause: str
    sub_cause: str | None = None
    is_root_cause: bool = False


class IshikawaCauseResponse(BaseModel):
    id: int
    category: str
    cause: str
    sub_cause: str | None
    is_root_cause: bool

    class Config:
        from_attributes = True


class IshikawaCreate(BaseModel):
    production_line_id: int | None = None
    title: str
    effect: str
    causes: list[IshikawaCauseCreate] = []
    conclusion: str | None = None


class IshikawaResponse(BaseModel):
    id: int
    title: str
    effect: str
    conclusion: str | None
    ai_generated: bool | None = False
    causes: list[IshikawaCauseResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# --- KAIZEN ---

class KaizenCreate(BaseModel):
    production_line_id: int | None = None
    title: str
    description: str
    category: str | None = None
    priority: str = "medium"
    expected_impact: str | None = None
    expected_savings_eur: float | None = None
    target_date: datetime | None = None
    assigned_to_id: int | None = None


class KaizenResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str | None
    priority: str
    status: str
    expected_impact: str | None
    expected_savings_eur: float | None
    actual_savings_eur: float | None
    ai_generated: bool | None = False
    ai_confidence: float | None
    created_at: datetime

    @field_validator("status", "priority", mode="before")
    @classmethod
    def normalize_enum(cls, v):
        return _lower(v)

    class Config:
        from_attributes = True


# --- SMED ---

class SMEDStepCreate(BaseModel):
    step_order: int
    description: str
    duration_seconds: float
    phase: str  # "internal" or "external"
    can_be_externalized: bool = False
    improvement_notes: str | None = None


class SMEDCreate(BaseModel):
    production_line_id: int
    changeover_name: str
    baseline_time_min: float
    current_time_min: float | None = None
    target_time_min: float | None = None
    steps: list[SMEDStepCreate] = []


class SMEDStepResponse(BaseModel):
    id: int
    step_order: int
    description: str
    duration_seconds: float
    phase: str
    can_be_externalized: bool
    improvement_notes: str | None

    class Config:
        from_attributes = True


class SMEDResponse(BaseModel):
    id: int
    production_line_id: int
    changeover_name: str
    baseline_time_min: float
    current_time_min: float | None
    target_time_min: float | None
    steps: list[SMEDStepResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True
