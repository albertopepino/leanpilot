"""
Role constants for the multi-site RBAC system.

Each role has a numeric level used for hierarchy checks:
  0 = viewer (read-only)
  1 = shop-floor roles (operator, quality inspector, maintenance)
  2 = supervisors
  3 = managers
  4 = plant manager
  5 = administrator
"""

ROLES = {
    "operator": {"level": 1, "label": "Operator"},
    "quality_inspector": {"level": 1, "label": "Quality Inspector"},
    "maintenance": {"level": 1, "label": "Maintenance Technician"},
    "line_supervisor": {"level": 2, "label": "Line Supervisor"},
    "quality_supervisor": {"level": 2, "label": "Quality Supervisor"},
    "production_manager": {"level": 3, "label": "Production Manager"},
    "quality_manager": {"level": 3, "label": "Quality Manager"},
    "plant_manager": {"level": 4, "label": "Plant Manager"},
    "admin": {"level": 5, "label": "Administrator"},
    "viewer": {"level": 0, "label": "Viewer"},
}

VALID_ROLES = set(ROLES.keys())


def get_role_level(role: str) -> int:
    """Return the numeric level for a role string, defaulting to 0."""
    return ROLES.get(role, {}).get("level", 0)


def role_meets_minimum(user_role: str, minimum_role: str) -> bool:
    """Check if user_role meets or exceeds minimum_role level."""
    return get_role_level(user_role) >= get_role_level(minimum_role)
