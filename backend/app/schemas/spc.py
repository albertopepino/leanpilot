"""Pydantic schemas for SPC (Statistical Process Control)."""

from pydantic import BaseModel
from datetime import datetime


# ─── Request Schemas ─────────────────────────────────────────────────────────


class SPCDataRequest(BaseModel):
    """Request params for fetching SPC measurement data."""
    line_id: int | None = None
    product_id: int | None = None
    check_type: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    subgroup_size: int = 5


class SPCCalculateRequest(BaseModel):
    """Request body for SPC control limit and capability calculations."""
    chart_type: str  # xbar_r, xbar_s, p, np, c, u
    measurements: list[list[float]]  # list of subgroups, each a list of values
    subgroup_size: int = 5
    usl: float | None = None  # upper specification limit
    lsl: float | None = None  # lower specification limit
    sample_sizes: list[int] | None = None  # for p/np charts (each subgroup's n)


# ─── Response Schemas ────────────────────────────────────────────────────────


class ControlLimits(BaseModel):
    ucl: float
    cl: float  # center line
    lcl: float


class WesternElectricViolation(BaseModel):
    rule: int  # 1-4
    rule_name: str
    point_index: int
    subgroup_index: int
    value: float


class SPCChartData(BaseModel):
    """Data for a single SPC chart (e.g., the X-bar part or the R part)."""
    chart_label: str  # "X-bar", "R", "S", "p", "np", "c", "u"
    values: list[float]
    control_limits: ControlLimits
    violations: list[WesternElectricViolation] = []


class ProcessCapability(BaseModel):
    cp: float | None = None
    cpk: float | None = None
    pp: float | None = None
    ppk: float | None = None
    sigma_level: float | None = None
    mean: float
    std_dev: float
    usl: float | None = None
    lsl: float | None = None


class SPCCalculateResponse(BaseModel):
    chart_type: str
    subgroup_size: int
    total_subgroups: int
    charts: list[SPCChartData]
    capability: ProcessCapability | None = None
    pct_in_control: float
    subgroup_labels: list[str] = []


class SPCLineConfig(BaseModel):
    line_id: int
    line_name: str
    chart_type: str
    subgroup_size: int
    usl: float | None = None
    lsl: float | None = None
    measurements: list[list[float]] = []
    sample_sizes: list[int] = []
    subgroup_labels: list[str] = []
