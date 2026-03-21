"""Pydantic schemas for the superadmin client management portal."""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class ClientCreate(BaseModel):
    """Create a new client (org + site + admin user in one step)."""
    organization_name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9\-]+$")
    subscription_tier: str = "starter"
    max_sites: int = 1
    max_users: int = 10
    # First site
    site_name: str = Field(..., min_length=1, max_length=255)
    site_location: str | None = None
    site_country: str | None = None
    # Admin user
    admin_email: EmailStr
    admin_full_name: str = Field(..., min_length=1, max_length=255)
    admin_password: str = Field(..., min_length=8)
    admin_language: str = "en"


class ClientSummary(BaseModel):
    """Lightweight client info for the portal list view."""
    id: int
    name: str
    slug: str
    logo_url: str | None = None
    subscription_tier: str
    max_sites: int
    max_users: int
    is_active: bool
    created_at: datetime | None = None
    site_count: int = 0
    user_count: int = 0

    model_config = {"from_attributes": True}


class ClientDetail(BaseModel):
    """Full client detail with sites and user counts."""
    id: int
    name: str
    slug: str
    logo_url: str | None = None
    subscription_tier: str
    max_sites: int
    max_users: int
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    sites: list["ClientSite"] = []
    users: list["ClientUser"] = []

    model_config = {"from_attributes": True}


class ClientSite(BaseModel):
    id: int
    name: str
    site_code: str | None = None
    location: str | None = None
    country: str | None = None

    model_config = {"from_attributes": True}


class ClientUser(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class ClientHealth(BaseModel):
    """Health/activity metrics for a client organization."""
    org_id: int
    org_name: str
    total_users: int = 0
    active_users_30d: int = 0
    total_sites: int = 0
    latest_oee: float | None = None
    open_kaizen: int = 0
    open_ncrs: int = 0


class ClientToggleRequest(BaseModel):
    is_active: bool


class GDPRExportResponse(BaseModel):
    """GDPR Art. 20 — Data portability export metadata."""
    org_id: int
    org_name: str
    export_date: str
    data: dict


# Forward refs
ClientDetail.model_rebuild()
