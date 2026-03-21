from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator, model_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "viewer"
    language: str = "en"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class LandingPageSignup(BaseModel):
    """Registration from the public landing page.
    GDPR Art. 6(1)(b) — processing necessary for contract performance.
    Art. 7 — consent must be freely given, specific, informed, unambiguous.
    """
    email: EmailStr
    factory_name: str = ""
    employee_count: str = ""
    language: str = "en"
    gdpr_consent: bool = False  # Must be True — enforced server-side
    privacy_policy_accepted: bool = False
    terms_accepted: bool = False
    ai_consent: bool = False  # Optional — separate consent for AI processing
    marketing_consent: bool = False  # Optional — GDPR requires opt-in


class SignupResponse(BaseModel):
    success: bool
    message: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    factory_id: int | None = None
    language: str = "en"
    privacy_policy_accepted_at: datetime | None = None
    terms_accepted_at: datetime | None = None
    consent_version: str | None = None
    ai_consent: bool | None = False
    marketing_consent: bool | None = False
    is_deleted: bool | None = False
    totp_enabled: bool | None = False
    is_superadmin: bool = False
    needs_consent: bool = False

    @model_validator(mode="before")
    @classmethod
    def compute_needs_consent(cls, data):
        """Pick up _needs_consent from ORM object if present."""
        if hasattr(data, "_needs_consent"):
            obj = data
            d = {
                "id": obj.id, "email": obj.email, "full_name": obj.full_name,
                "role": obj.role.value if hasattr(obj.role, "value") else obj.role,
                "is_active": obj.is_active, "factory_id": obj.factory_id,
                "language": obj.language,
                "privacy_policy_accepted_at": obj.privacy_policy_accepted_at,
                "terms_accepted_at": obj.terms_accepted_at,
                "consent_version": obj.consent_version,
                "ai_consent": obj.ai_consent,
                "marketing_consent": obj.marketing_consent,
                "is_deleted": obj.is_deleted,
                "totp_enabled": getattr(obj, "totp_enabled", False),
                "is_superadmin": getattr(obj, "is_superadmin", False),
                "needs_consent": obj._needs_consent,
            }
            return d
        return data

    model_config = {"from_attributes": True}


class ConsentAcceptRequest(BaseModel):
    """First-login consent acceptance — GDPR Art. 7."""
    privacy_policy_accepted: bool
    terms_accepted: bool
    ai_consent: bool = False
    marketing_consent: bool = False


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v


class ConsentUpdateRequest(BaseModel):
    """Update granular consent preferences — GDPR Art. 7(3) right to withdraw."""
    ai_consent: bool | None = None
    marketing_consent: bool | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        from app.core.security import validate_password_strength
        errors = validate_password_strength(v)
        if errors:
            raise ValueError("; ".join(errors))
        return v
