"""Pydantic schemas for multi-site organization management."""

from datetime import datetime
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9\-]+$")
    logo_url: str | None = None
    subscription_tier: str = "starter"
    max_sites: int = 1
    max_users: int = 10


class OrganizationUpdate(BaseModel):
    name: str | None = None
    slug: str | None = Field(None, max_length=100, pattern=r"^[a-z0-9\-]+$")
    logo_url: str | None = None
    subscription_tier: str | None = None
    max_sites: int | None = None
    max_users: int | None = None
    is_active: bool | None = None


class OrganizationResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class OrganizationWithSites(OrganizationResponse):
    """Organization response including its sites list."""
    sites: list["SiteBasic"] = []


# ---------------------------------------------------------------------------
# Site (Factory) summaries
# ---------------------------------------------------------------------------

class SiteCreate(BaseModel):
    """Request body for creating a new site."""
    name: str = Field(..., min_length=1, max_length=255)
    site_code: str | None = Field(None, max_length=20)
    location: str | None = Field(None, max_length=255)
    country: str | None = Field(None, max_length=100)


class SiteBasic(BaseModel):
    """Minimal site info for lists and dropdowns."""
    id: int
    name: str
    site_code: str | None = None
    location: str | None = None
    country: str | None = None

    model_config = {"from_attributes": True}


class SiteSummary(BaseModel):
    """Site summary with KPIs for the corporate dashboard."""
    id: int
    name: str
    site_code: str | None = None
    location: str | None = None
    country: str | None = None
    oee: float | None = None
    safety_days: int | None = None
    open_ncrs: int | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# UserSiteRole
# ---------------------------------------------------------------------------

class UserSiteRoleCreate(BaseModel):
    site_id: int | None = None  # NULL = org-level role
    organization_id: int
    role: str = Field(..., min_length=1, max_length=50)
    scope_line_ids: list[int] | None = None
    is_primary: bool = False


class UserSiteRoleResponse(BaseModel):
    id: int
    user_id: int
    site_id: int | None = None
    organization_id: int
    role: str
    scope_line_ids: list[int] | None = None
    is_primary: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Corporate dashboard
# ---------------------------------------------------------------------------

class CorporateDashboard(BaseModel):
    """Aggregated KPIs across all sites in an organization."""
    organization: OrganizationResponse
    sites: list[SiteSummary]
    total_sites: int
    avg_oee: float | None = None
    total_open_ncrs: int = 0
    total_safety_days: int | None = None


# Rebuild forward refs
OrganizationWithSites.model_rebuild()
