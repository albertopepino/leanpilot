"""
Admin panel schemas — user management, role/permission configuration.
"""
from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime


class AdminUserUpdate(BaseModel):
    """Update a user's role, active status, or language."""
    role: str | None = None
    is_active: bool | None = None
    language: str | None = None
    full_name: str | None = None


class AdminUserCreate(BaseModel):
    """Admin creates a new user within their factory."""
    email: EmailStr
    full_name: str
    role: str = "viewer"
    language: str = "en"
    password: str | None = None  # Auto-generated if not provided

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if v is not None:
            from app.core.security import validate_password_strength
            errors = validate_password_strength(v)
            if errors:
                raise ValueError("; ".join(errors))
        return v


class AdminUserResponse(BaseModel):
    """Full user info visible to admin."""
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    factory_id: int | None
    language: str
    last_login_at: datetime | None = None
    created_at: datetime | None = None
    ai_consent: bool = False
    marketing_consent: bool = False
    is_deleted: bool = False

    class Config:
        from_attributes = True


class AdminResetPasswordResponse(BaseModel):
    detail: str
    temporary_password: str


class AuditLogEntry(BaseModel):
    id: int
    action: str
    resource_type: str
    resource_id: str | None = None
    user_email: str | None = None
    detail: str | None = None
    ip_address: str | None = None
    timestamp: datetime
    legal_basis: str | None = None

    class Config:
        from_attributes = True


# ---- Tab/Permission config ----

# Define which tabs each role can access and at what permission level.
# This is the source of truth — frontend reads it, backend can enforce it.

TAB_PERMISSIONS: dict[str, dict[str, str]] = {
    # role -> { tab_id -> "view" | "modify" | "full" | "hidden" }
    "admin": {
        "assessment": "full", "dashboard": "full", "hourly": "full",
        "andon": "full", "production": "full", "five-why": "full",
        "ishikawa": "full", "pareto": "full", "a3": "full",
        "kaizen": "full", "vsm": "full", "smed": "full", "gemba": "full",
        "six-s": "full", "tpm": "full", "cilt": "full",
        "copilot": "full", "resources": "full", "admin": "full",
        "master-calendar": "full",
    },
    "plant_manager": {
        "assessment": "full", "dashboard": "full", "hourly": "full",
        "andon": "full", "production": "full", "five-why": "full",
        "ishikawa": "full", "pareto": "full", "a3": "full",
        "kaizen": "full", "vsm": "full", "smed": "full", "gemba": "full",
        "six-s": "full", "tpm": "full", "cilt": "full",
        "copilot": "full", "resources": "full", "admin": "hidden",
        "master-calendar": "full",
    },
    "line_supervisor": {
        "assessment": "view", "dashboard": "full", "hourly": "full",
        "andon": "full", "production": "full", "five-why": "full",
        "ishikawa": "full", "pareto": "full", "a3": "modify",
        "kaizen": "full", "vsm": "view", "smed": "full", "gemba": "modify",
        "six-s": "full", "tpm": "full", "cilt": "full",
        "copilot": "full", "resources": "view", "admin": "hidden",
        "master-calendar": "view",
    },
    "operator": {
        "assessment": "hidden", "dashboard": "view", "hourly": "full",
        "andon": "full", "production": "full", "five-why": "modify",
        "ishikawa": "view", "pareto": "view", "a3": "view",
        "kaizen": "modify", "vsm": "hidden", "smed": "view", "gemba": "hidden",
        "six-s": "modify", "tpm": "modify", "cilt": "full",
        "copilot": "view", "resources": "view", "admin": "hidden",
        "master-calendar": "view",
    },
    "viewer": {
        "assessment": "hidden", "dashboard": "view", "hourly": "view",
        "andon": "view", "production": "hidden", "five-why": "view",
        "ishikawa": "view", "pareto": "view", "a3": "view",
        "kaizen": "view", "vsm": "view", "smed": "view", "gemba": "view",
        "six-s": "view", "tpm": "view", "cilt": "view",
        "copilot": "hidden", "resources": "view", "admin": "hidden",
        "master-calendar": "view",
    },
}

# Permission ranking for group policy merging (higher = more access)
PERMISSION_RANK = {"hidden": 0, "view": 1, "modify": 2, "full": 3}
RANK_PERMISSION = {v: k for k, v in PERMISSION_RANK.items()}
