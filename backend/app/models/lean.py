from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text, Enum as SAEnum, Boolean, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone

from app.models.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Helper: normalize enum values from DB (handles UPPERCASE from PostgreSQL)
# ---------------------------------------------------------------------------
def _normalize_enum(value, enum_class):
    """Convert a raw DB string to its canonical lowercase enum value.
    Handles UPPERCASE values stored by seed_demo.py and native enum names."""
    if value is None:
        return None
    if isinstance(value, enum_class):
        return value.value
    s = str(value).lower()
    # Try matching by value first, then by name
    for member in enum_class:
        if member.value == s or member.name.lower() == s:
            return member.value
    return s  # fallback: return lowercase string as-is


# --- OEE ---

class OEERecord(TimestampMixin, Base):
    """Calculated OEE snapshot for a production line per shift/day."""
    __tablename__ = "oee_records"

    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    production_record_id = Column(Integer, ForeignKey("production_records.id"), nullable=True)
    date = Column(DateTime(timezone=True), nullable=False)

    availability = Column(Float, nullable=False)  # 0-100%
    performance = Column(Float, nullable=False)   # 0-100%
    quality = Column(Float, nullable=False)        # 0-100%
    oee = Column(Float, nullable=False)            # 0-100%

    planned_time_min = Column(Float)
    run_time_min = Column(Float)
    total_pieces = Column(Integer)
    good_pieces = Column(Integer)
    downtime_min = Column(Float)


# --- 5 WHY ---

class FiveWhyStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"


class FiveWhyAnalysis(TimestampMixin, Base):
    __tablename__ = "five_why_analyses"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    problem_statement = Column(Text, nullable=False)
    status = Column(String, default="open")
    root_cause = Column(Text)
    countermeasure = Column(Text)
    responsible = Column(String)
    due_date = Column(DateTime(timezone=True))
    verified_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    ai_generated = Column(Boolean, default=False)

    steps = relationship("FiveWhyStep", back_populates="analysis", order_by="FiveWhyStep.step_number")

    @property
    def status_normalized(self) -> str:
        return _normalize_enum(self.status, FiveWhyStatus)


class FiveWhyStep(TimestampMixin, Base):
    __tablename__ = "five_why_steps"

    analysis_id = Column(Integer, ForeignKey("five_why_analyses.id"), nullable=False)
    step_number = Column(Integer, nullable=False)  # 1-5
    why_question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)

    analysis = relationship("FiveWhyAnalysis", back_populates="steps")


# --- ISHIKAWA ---

class IshikawaCategory(str, enum.Enum):
    MAN = "man"
    MACHINE = "machine"
    METHOD = "method"
    MATERIAL = "material"
    MEASUREMENT = "measurement"
    ENVIRONMENT = "environment"


class IshikawaAnalysis(TimestampMixin, Base):
    __tablename__ = "ishikawa_analyses"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    effect = Column(Text, nullable=False)  # The problem/effect being analyzed
    conclusion = Column(Text)
    ai_generated = Column(Boolean, default=False)

    causes = relationship("IshikawaCause", back_populates="analysis")


class IshikawaCause(TimestampMixin, Base):
    __tablename__ = "ishikawa_causes"

    analysis_id = Column(Integer, ForeignKey("ishikawa_analyses.id"), nullable=False)
    category = Column(String, nullable=False)
    cause = Column(Text, nullable=False)
    sub_cause = Column(Text)
    is_root_cause = Column(Boolean, default=False)

    analysis = relationship("IshikawaAnalysis", back_populates="causes")


# --- KAIZEN ---

class KaizenPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class KaizenStatus(str, enum.Enum):
    IDEA = "idea"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class KaizenItem(TimestampMixin, Base):
    __tablename__ = "kaizen_items"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String)  # e.g. "quality", "productivity", "safety", "cost"
    priority = Column(String, default="medium")
    status = Column(String, default="idea")

    expected_impact = Column(Text)
    expected_savings_eur = Column(Float)
    actual_savings_eur = Column(Float)

    start_date = Column(DateTime(timezone=True))
    target_date = Column(DateTime(timezone=True))
    completion_date = Column(DateTime(timezone=True))

    ai_generated = Column(Boolean, default=False)
    ai_confidence = Column(Float)  # 0-1 confidence score from AI

    @property
    def priority_normalized(self) -> str:
        return _normalize_enum(self.priority, KaizenPriority)

    @property
    def status_normalized(self) -> str:
        return _normalize_enum(self.status, KaizenStatus)


# --- SMED ---

class SMEDPhase(str, enum.Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"


class SMEDRecord(TimestampMixin, Base):
    __tablename__ = "smed_records"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    production_line_id = Column(Integer, ForeignKey("production_lines.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    changeover_name = Column(String, nullable=False)  # e.g. "Format change A→B"
    baseline_time_min = Column(Float, nullable=False)
    current_time_min = Column(Float)
    target_time_min = Column(Float)
    date_recorded = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    steps = relationship("SMEDStep", back_populates="record", order_by="SMEDStep.step_order")


class SMEDStep(TimestampMixin, Base):
    __tablename__ = "smed_steps"

    record_id = Column(Integer, ForeignKey("smed_records.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    phase = Column(String, nullable=False)
    can_be_externalized = Column(Boolean, default=False)
    improvement_notes = Column(Text)

    record = relationship("SMEDRecord", back_populates="steps")


# --- LEAN ASSESSMENT ---

class LeanAssessment(TimestampMixin, Base):
    """Lean maturity assessment snapshot for a factory."""
    __tablename__ = "lean_assessments"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    assessed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    scores = Column(JSON, nullable=False, default=dict)          # {category: score}
    overall_score = Column(Float, nullable=False, default=0.0)
    maturity_level = Column(String, nullable=False, default="")  # e.g. "Beginner", "Developing"
    recommendations = Column(JSON, nullable=False, default=list)  # [{"tool": ..., "priority": ...}]
    answers = Column(JSON, nullable=False, default=dict)          # {question_id: answer_id}


# --- MIND MAP ---

class MindMap(TimestampMixin, Base):
    """Mind map for brainstorming and root-cause analysis."""
    __tablename__ = "mind_maps"

    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False, default="")
    description = Column(String, nullable=False, default="")
    nodes = Column(JSON, nullable=False, default=list)         # [{id, text, x, y, color, parentId}]
    connectors = Column(JSON, nullable=False, default=list)    # [{id, fromId, toId, label, color}]
