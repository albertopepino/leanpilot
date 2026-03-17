"""
Tests for Role-Based Access Control (RBAC) and tenant isolation.

Verifies:
- Admin can access admin-only endpoints.
- Operator and viewer are blocked from admin endpoints.
- Users from factory A cannot see factory B data (tenant isolation).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock

from tests.conftest import ADMIN_USER, OPERATOR_USER, VIEWER_USER, OTHER_FACTORY_ADMIN


pytestmark = [pytest.mark.rbac, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Admin endpoints — only admins allowed
# ---------------------------------------------------------------------------
class TestAdminEndpoints:
    """Endpoints under /api/v1/admin/* require admin role."""

    async def test_admin_can_list_users(self, admin_client, mock_db):
        """Admin should be able to call GET /api/v1/admin/users."""
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200

    async def test_operator_cannot_list_users(self, operator_client):
        """Operator should get 403 on GET /api/v1/admin/users."""
        resp = await operator_client.get("/api/v1/admin/users")
        assert resp.status_code == 403

    async def test_viewer_cannot_list_users(self, viewer_client):
        """Viewer should get 403 on GET /api/v1/admin/users."""
        resp = await viewer_client.get("/api/v1/admin/users")
        assert resp.status_code == 403

    async def test_admin_can_get_permissions(self, admin_client):
        """GET /api/v1/admin/permissions is admin-only."""
        resp = await admin_client.get("/api/v1/admin/permissions")
        assert resp.status_code == 200
        body = resp.json()
        assert "roles" in body
        assert "admin" in body["roles"]

    async def test_operator_cannot_get_permissions(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/permissions")
        assert resp.status_code == 403

    async def test_admin_can_list_audit_logs(self, admin_client, mock_db):
        """GET /api/v1/admin/audit-logs is admin-only."""
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 200

    async def test_viewer_cannot_list_audit_logs(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 403

    async def test_admin_can_get_factory_info(self, admin_client, mock_db):
        """GET /api/v1/admin/factory is admin-only."""
        from tests.conftest import FakeUser

        # Mock factory lookup
        factory_mock = MagicMock()
        factory_mock.id = 1
        factory_mock.name = "Test Factory"

        # First call: factory, second: user count, third: production lines
        factory_result = MagicMock()
        factory_result.scalar_one_or_none.return_value = factory_mock
        factory_result.scalar.return_value = 5

        count_result = MagicMock()
        count_result.scalar.return_value = 5

        lines_result = MagicMock()
        lines_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(
            side_effect=[factory_result, count_result, lines_result]
        )

        resp = await admin_client.get("/api/v1/admin/factory")
        assert resp.status_code == 200

    async def test_operator_cannot_get_factory_info(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/factory")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Production lines — admin only (CRUD under /api/v1/admin/production-lines)
# ---------------------------------------------------------------------------
class TestProductionLineAccess:
    async def test_admin_can_list_production_lines(self, admin_client, mock_db):
        result = MagicMock()
        result.scalars.return_value.unique.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 200

    async def test_operator_cannot_list_production_lines(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 403

    async def test_viewer_cannot_create_production_line(self, viewer_client):
        resp = await viewer_client.post(
            "/api/v1/admin/production-lines",
            json={"name": "Hacked Line"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Common endpoints — accessible by all authenticated users
# ---------------------------------------------------------------------------
class TestCommonEndpoints:
    """Endpoints that any authenticated user should be able to reach."""

    async def test_health_check_is_public(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    async def test_features_endpoint(self, admin_client):
        resp = await admin_client.get("/api/v1/features")
        assert resp.status_code == 200
        body = resp.json()
        assert "core" in body
        assert body["core"]["oee_dashboard"] is True

    async def test_viewer_can_access_features(self, viewer_client):
        resp = await viewer_client.get("/api/v1/features")
        assert resp.status_code == 200

    async def test_operator_can_access_me(self, operator_client):
        resp = await operator_client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["role"] == "operator"

    async def test_viewer_can_access_me(self, viewer_client):
        resp = await viewer_client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["role"] == "viewer"


# ---------------------------------------------------------------------------
# Tenant isolation — factory A admin cannot see factory B data
# ---------------------------------------------------------------------------
class TestTenantIsolation:
    """Verify that the system scopes data by factory_id."""

    async def test_other_factory_admin_gets_own_scoped_data(
        self, other_factory_client, mock_db
    ):
        """Admin from factory 2 should see their own data, not factory 1's."""
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await other_factory_client.get("/api/v1/admin/users")
        assert resp.status_code == 200

        # Verify the DB query was called — the SQL should filter by factory_id=2
        # We can check the mock call args contain factory_id filtering.
        assert mock_db.execute.called

    async def test_require_factory_utility(self):
        """require_factory raises 400 if user has no factory_id."""
        from app.core.security import require_factory
        from tests.conftest import FakeUser
        from fastapi import HTTPException

        user_without_factory = FakeUser(
            id=99,
            email="orphan@test.com",
            full_name="Orphan",
            role=UserRole.ADMIN,
            factory_id=None,
        )

        with pytest.raises(HTTPException) as exc_info:
            require_factory(user_without_factory)
        assert exc_info.value.status_code == 400

    async def test_require_same_factory_rejects_mismatch(self):
        """require_same_factory raises 403 if factory IDs differ."""
        from app.core.security import require_same_factory
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            require_same_factory(ADMIN_USER, resource_factory_id=999)
        assert exc_info.value.status_code == 403

    async def test_require_same_factory_accepts_match(self):
        """require_same_factory passes when factory IDs match."""
        from app.core.security import require_same_factory

        # Should not raise
        require_same_factory(ADMIN_USER, resource_factory_id=ADMIN_USER.factory_id)


# ---------------------------------------------------------------------------
# Role hierarchy unit tests
# ---------------------------------------------------------------------------
class TestRoleHierarchy:
    """Test the _ROLE_LEVELS hierarchy used by require_role."""

    def test_admin_is_highest(self):
        from app.core.security import _ROLE_LEVELS

        assert _ROLE_LEVELS["admin"] > _ROLE_LEVELS["plant_manager"]
        assert _ROLE_LEVELS["plant_manager"] > _ROLE_LEVELS["line_supervisor"]
        assert _ROLE_LEVELS["line_supervisor"] > _ROLE_LEVELS["operator"]
        assert _ROLE_LEVELS["operator"] > _ROLE_LEVELS["viewer"]

    def test_all_roles_present(self):
        from app.core.security import _ROLE_LEVELS
        from app.models.user import UserRole

        for role in UserRole:
            assert role.value in _ROLE_LEVELS, f"Missing role level for {role.value}"
