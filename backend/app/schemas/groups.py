"""
Group policies schemas — group management, policy configuration, membership.
"""
from pydantic import BaseModel, field_validator
from datetime import datetime


VALID_TAB_IDS = {
    "home", "assessment", "copilot", "resources", "production-orders",
    "products", "production", "andon", "dashboard", "consolidated-oee",
    "hourly", "pareto", "defect-catalog", "qc-checks", "five-why",
    "ishikawa", "vsm", "gemba", "safety", "a3", "mind-map", "kaizen",
    "smed", "capa", "tpm", "cilt", "six-s", "qc-policies", "ncr",
    "settings", "admin", "master-calendar",
}

VALID_PERMISSIONS = {"full", "modify", "view", "hidden"}


class GroupCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    is_active: bool | None = None


class GroupPolicyItem(BaseModel):
    tab_id: str
    permission: str

    @field_validator("tab_id")
    @classmethod
    def validate_tab_id(cls, v: str) -> str:
        if v not in VALID_TAB_IDS:
            raise ValueError(f"Invalid tab_id '{v}'. Must be one of: {', '.join(sorted(VALID_TAB_IDS))}")
        return v

    @field_validator("permission")
    @classmethod
    def validate_permission(cls, v: str) -> str:
        if v not in VALID_PERMISSIONS:
            raise ValueError(f"Invalid permission '{v}'. Must be one of: {', '.join(sorted(VALID_PERMISSIONS))}")
        return v


class GroupPoliciesSet(BaseModel):
    policies: list[GroupPolicyItem]


class GroupMemberUpdate(BaseModel):
    user_ids: list[int]


class GroupResponse(BaseModel):
    id: int
    factory_id: int
    name: str
    description: str | None = None
    color: str | None = None
    is_active: bool
    policies: list[GroupPolicyItem] = []
    member_ids: list[int] = []
    member_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
