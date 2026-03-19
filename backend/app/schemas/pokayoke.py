from typing import Literal
from pydantic import BaseModel, Field
from datetime import date, datetime


# ─── Constrained types ───────────────────────────────────────────────────────

DeviceType = Literal[
    "contact", "fixed_value", "motion_step",
    "informational", "warning", "control",
]
VerificationFrequency = Literal["daily", "weekly", "monthly"]
DeviceStatus = Literal["active", "inactive", "needs_repair"]
VerificationResult = Literal["PASS", "FAIL"]


# ─── Device schemas ──────────────────────────────────────────────────────────

class PokaYokeDeviceCreate(BaseModel):
    production_line_id: int | None = None
    name: str = Field(..., max_length=200)
    device_type: DeviceType
    location: str | None = Field(None, max_length=200)
    process_step: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=1000)
    installation_date: date | None = None
    verification_frequency: VerificationFrequency = "weekly"
    effectiveness_rate: float | None = Field(100.0, ge=0, le=100)
    status: DeviceStatus = "active"


class PokaYokeDeviceUpdate(BaseModel):
    production_line_id: int | None = None
    name: str | None = Field(None, max_length=200)
    device_type: DeviceType | None = None
    location: str | None = Field(None, max_length=200)
    process_step: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=1000)
    installation_date: date | None = None
    verification_frequency: VerificationFrequency | None = None
    effectiveness_rate: float | None = Field(None, ge=0, le=100)
    status: DeviceStatus | None = None


class PokaYokeDeviceResponse(BaseModel):
    id: int
    factory_id: int
    production_line_id: int | None = None
    name: str
    device_type: str
    location: str | None = None
    process_step: str | None = None
    description: str | None = None
    installation_date: date | None = None
    verification_frequency: str
    last_verified_at: datetime | None = None
    effectiveness_rate: float | None = None
    status: str
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Verification schemas ────────────────────────────────────────────────────

class PokaYokeVerificationCreate(BaseModel):
    result: VerificationResult
    notes: str | None = Field(None, max_length=1000)


class PokaYokeVerificationResponse(BaseModel):
    id: int
    device_id: int
    factory_id: int
    verified_by_id: int
    result: str
    notes: str | None = None
    verified_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Statistics response ─────────────────────────────────────────────────────

class PokaYokeStatsResponse(BaseModel):
    total_devices: int
    active_count: int
    inactive_count: int
    needs_repair_count: int
    overdue_count: int
    avg_effectiveness: float | None = None
    by_type: dict[str, int]
    by_status: dict[str, int]
    recent_verifications: list[PokaYokeVerificationResponse] = []
