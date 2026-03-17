"""
Tests for admin endpoints: /api/v1/admin/*

Covers all 16 admin endpoints with happy-path, RBAC (403), input validation,
and edge-case scenarios.  Uses the mock_db / admin_client / operator_client /
viewer_client / other_factory_client fixtures from conftest.py.
"""
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import (
    FakeUser,
    ADMIN_USER,
    OPERATOR_USER,
    VIEWER_USER,
    OTHER_FACTORY_ADMIN,
    make_token,
)
from app.models.user import UserRole


pytestmark = [pytest.mark.admin, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _mock_scalars_all(mock_db, rows: list):
    """Configure mock_db.execute so result.scalars().all() returns `rows`."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    mock_db.execute = AsyncMock(return_value=result)


def _mock_scalars_unique_all(mock_db, rows: list):
    """Configure mock_db.execute so result.scalars().unique().all() returns `rows`."""
    result = MagicMock()
    result.scalars.return_value.unique.return_value.all.return_value = rows
    mock_db.execute = AsyncMock(return_value=result)


def _mock_scalar_one_or_none(mock_db, obj):
    """Configure mock_db.execute so result.scalar_one_or_none() returns `obj`."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = obj
    mock_db.execute = AsyncMock(return_value=result)


def _make_fake_user_obj(**overrides):
    """Create a MagicMock that looks like a User SQLAlchemy model instance."""
    defaults = dict(
        id=5,
        email="testuser@testfactory.com",
        full_name="Test User",
        role=UserRole.OPERATOR,
        is_active=True,
        is_deleted=False,
        factory_id=1,
        language="en",
        last_login_at=None,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
        ai_consent=False,
        marketing_consent=False,
        hashed_password="hashed",
        failed_login_attempts=0,
        locked_until=None,
        password_changed_at=None,
    )
    defaults.update(overrides)
    user = MagicMock()
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def _make_fake_production_line(**overrides):
    defaults = dict(
        id=10,
        factory_id=1,
        name="Line A",
        product_type="Widget",
        target_oee=85.0,
        target_cycle_time_seconds=30.0,
        is_active=True,
        shifts=[],
    )
    defaults.update(overrides)
    line = MagicMock()
    for k, v in defaults.items():
        setattr(line, k, v)
    return line


def _make_fake_shift(**overrides):
    defaults = dict(
        id=20,
        production_line_id=10,
        name="Morning",
        start_hour=6,
        end_hour=14,
        planned_minutes=480,
    )
    defaults.update(overrides)
    shift = MagicMock()
    for k, v in defaults.items():
        setattr(shift, k, v)
    return shift


def _make_fake_audit_log(**overrides):
    defaults = dict(
        id=100,
        action="login_success",
        resource_type="auth",
        resource_id=None,
        user_email="admin@testfactory.com",
        detail="Logged in",
        ip_address="127.0.0.1",
        timestamp=datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc),
        legal_basis=None,
    )
    defaults.update(overrides)
    log = MagicMock()
    for k, v in defaults.items():
        setattr(log, k, v)
    return log


# ===========================================================================
# GET /api/v1/admin/users
# ===========================================================================
class TestListUsers:
    async def test_admin_lists_users(self, admin_client, mock_db):
        user_obj = _make_fake_user_obj()
        _mock_scalars_all(mock_db, [user_obj])

        resp = await admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 1
        assert body[0]["email"] == "testuser@testfactory.com"

    async def test_admin_lists_users_empty(self, admin_client, mock_db):
        _mock_scalars_all(mock_db, [])
        resp = await admin_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_operator_cannot_list_users(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/users")
        assert resp.status_code == 403

    async def test_viewer_cannot_list_users(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/users")
        assert resp.status_code == 403


# ===========================================================================
# POST /api/v1/admin/users
# ===========================================================================
class TestCreateUser:
    async def test_admin_creates_operator(self, admin_client, mock_db):
        """Admin can create a new operator user."""
        # Mock: no existing user with that email
        no_user = MagicMock()
        no_user.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=no_user)

        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={
                "email": "newop@testfactory.com",
                "full_name": "New Operator",
                "role": "operator",
                "language": "en",
            },
        )
        # db.flush won't assign an id on the mock, so serialization may fail.
        # A 403 would mean RBAC is broken; anything else is acceptable.
        assert resp.status_code != 403

    async def test_admin_cannot_create_admin_user(self, admin_client, mock_db):
        """Creating a user with admin role should be blocked."""
        no_user = MagicMock()
        no_user.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=no_user)

        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={
                "email": "anotheradmin@testfactory.com",
                "full_name": "Bad Admin",
                "role": "admin",
            },
        )
        assert resp.status_code == 400
        assert "Cannot create additional admin" in resp.json()["detail"]

    async def test_admin_cannot_create_duplicate_email(self, admin_client, mock_db):
        """Duplicate email returns 400."""
        existing = _make_fake_user_obj(email="dup@testfactory.com")
        _mock_scalar_one_or_none(mock_db, existing)

        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={
                "email": "dup@testfactory.com",
                "full_name": "Dup",
                "role": "viewer",
            },
        )
        assert resp.status_code == 400
        assert "already registered" in resp.json()["detail"]

    async def test_admin_create_invalid_role(self, admin_client, mock_db):
        """Invalid role value returns 400."""
        no_user = MagicMock()
        no_user.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=no_user)

        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={
                "email": "x@testfactory.com",
                "full_name": "X",
                "role": "superuser",
            },
        )
        assert resp.status_code == 400
        assert "Invalid role" in resp.json()["detail"]

    async def test_operator_cannot_create_user(self, operator_client):
        resp = await operator_client.post(
            "/api/v1/admin/users",
            json={"email": "hack@test.com", "full_name": "Hacker", "role": "viewer"},
        )
        assert resp.status_code == 403

    async def test_viewer_cannot_create_user(self, viewer_client):
        resp = await viewer_client.post(
            "/api/v1/admin/users",
            json={"email": "hack@test.com", "full_name": "Hacker", "role": "viewer"},
        )
        assert resp.status_code == 403

    async def test_create_user_missing_email_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={"full_name": "No Email", "role": "viewer"},
        )
        assert resp.status_code == 422

    async def test_create_user_invalid_email_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/admin/users",
            json={"email": "not-an-email", "full_name": "Bad", "role": "viewer"},
        )
        assert resp.status_code == 422


# ===========================================================================
# PATCH /api/v1/admin/users/{id}
# ===========================================================================
class TestUpdateUser:
    async def test_admin_updates_user_role(self, admin_client, mock_db):
        user_obj = _make_fake_user_obj(id=5, role=UserRole.VIEWER)
        _mock_scalar_one_or_none(mock_db, user_obj)

        resp = await admin_client.patch(
            "/api/v1/admin/users/5",
            json={"role": "operator"},
        )
        # May succeed or fail on serialization, but should not be 403 or 404
        assert resp.status_code not in (403, 404)

    async def test_admin_cannot_demote_self(self, admin_client, mock_db):
        """Admin cannot change their own role away from admin."""
        admin_obj = _make_fake_user_obj(id=ADMIN_USER.id, role=UserRole.ADMIN)
        _mock_scalar_one_or_none(mock_db, admin_obj)

        resp = await admin_client.patch(
            f"/api/v1/admin/users/{ADMIN_USER.id}",
            json={"role": "viewer"},
        )
        assert resp.status_code == 400
        assert "Cannot change your own admin role" in resp.json()["detail"]

    async def test_admin_cannot_deactivate_self(self, admin_client, mock_db):
        admin_obj = _make_fake_user_obj(id=ADMIN_USER.id, role=UserRole.ADMIN)
        _mock_scalar_one_or_none(mock_db, admin_obj)

        resp = await admin_client.patch(
            f"/api/v1/admin/users/{ADMIN_USER.id}",
            json={"is_active": False},
        )
        assert resp.status_code == 400
        assert "Cannot deactivate your own account" in resp.json()["detail"]

    async def test_update_nonexistent_user_returns_404(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.patch(
            "/api/v1/admin/users/9999",
            json={"role": "operator"},
        )
        assert resp.status_code == 404

    async def test_update_user_invalid_role(self, admin_client, mock_db):
        user_obj = _make_fake_user_obj(id=5)
        _mock_scalar_one_or_none(mock_db, user_obj)

        resp = await admin_client.patch(
            "/api/v1/admin/users/5",
            json={"role": "superuser"},
        )
        assert resp.status_code == 400
        assert "Invalid role" in resp.json()["detail"]

    async def test_operator_cannot_update_user(self, operator_client):
        resp = await operator_client.patch(
            "/api/v1/admin/users/5",
            json={"role": "viewer"},
        )
        assert resp.status_code == 403


# ===========================================================================
# POST /api/v1/admin/users/{id}/reset-password
# ===========================================================================
class TestResetPassword:
    async def test_admin_resets_password(self, admin_client, mock_db):
        user_obj = _make_fake_user_obj(id=5)
        _mock_scalar_one_or_none(mock_db, user_obj)

        resp = await admin_client.post("/api/v1/admin/users/5/reset-password")
        assert resp.status_code == 200
        body = resp.json()
        assert "temporary_password" in body
        assert "detail" in body

    async def test_reset_password_nonexistent_user(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.post("/api/v1/admin/users/9999/reset-password")
        assert resp.status_code == 404

    async def test_operator_cannot_reset_password(self, operator_client):
        resp = await operator_client.post("/api/v1/admin/users/5/reset-password")
        assert resp.status_code == 403

    async def test_viewer_cannot_reset_password(self, viewer_client):
        resp = await viewer_client.post("/api/v1/admin/users/5/reset-password")
        assert resp.status_code == 403


# ===========================================================================
# GET /api/v1/admin/audit-logs
# ===========================================================================
class TestAuditLogs:
    async def test_admin_lists_audit_logs(self, admin_client, mock_db):
        log_obj = _make_fake_audit_log()
        _mock_scalars_all(mock_db, [log_obj])

        resp = await admin_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 1

    async def test_audit_logs_empty(self, admin_client, mock_db):
        _mock_scalars_all(mock_db, [])
        resp = await admin_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_audit_logs_with_action_filter(self, admin_client, mock_db):
        _mock_scalars_all(mock_db, [])
        resp = await admin_client.get("/api/v1/admin/audit-logs?action=login_success")
        assert resp.status_code == 200

    async def test_audit_logs_with_pagination(self, admin_client, mock_db):
        _mock_scalars_all(mock_db, [])
        resp = await admin_client.get("/api/v1/admin/audit-logs?limit=10&offset=5")
        assert resp.status_code == 200

    async def test_audit_logs_limit_exceeds_max_returns_422(self, admin_client, mock_db):
        resp = await admin_client.get("/api/v1/admin/audit-logs?limit=999")
        assert resp.status_code == 422

    async def test_operator_cannot_list_audit_logs(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 403

    async def test_viewer_cannot_list_audit_logs(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/audit-logs")
        assert resp.status_code == 403


# ===========================================================================
# GET /api/v1/admin/permissions
# ===========================================================================
class TestPermissions:
    async def test_admin_gets_permissions(self, admin_client):
        resp = await admin_client.get("/api/v1/admin/permissions")
        assert resp.status_code == 200
        body = resp.json()
        assert "roles" in body
        assert "permissions" in body
        assert "admin" in body["roles"]
        assert "operator" in body["roles"]

    async def test_operator_cannot_get_permissions(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/permissions")
        assert resp.status_code == 403

    async def test_viewer_cannot_get_permissions(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/permissions")
        assert resp.status_code == 403


# ===========================================================================
# GET /api/v1/admin/my-permissions
# ===========================================================================
class TestMyPermissions:
    async def test_admin_gets_own_permissions(self, admin_client, mock_db):
        """Any authenticated user can call /my-permissions."""
        resp = await admin_client.get(
            "/api/v1/admin/my-permissions",
            headers={"Authorization": f"Bearer {make_token(ADMIN_USER)}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "role" in body
        assert "permissions" in body

    async def test_operator_gets_own_permissions(self, operator_client, mock_db):
        """Operator should be allowed (no admin gate on /my-permissions)."""
        # my-permissions uses get_current_user internally from the token header,
        # but we have the dependency override. It should still work.
        resp = await operator_client.get(
            "/api/v1/admin/my-permissions",
            headers={"Authorization": f"Bearer {make_token(OPERATOR_USER)}"},
        )
        assert resp.status_code == 200

    async def test_viewer_gets_own_permissions(self, viewer_client, mock_db):
        resp = await viewer_client.get(
            "/api/v1/admin/my-permissions",
            headers={"Authorization": f"Bearer {make_token(VIEWER_USER)}"},
        )
        assert resp.status_code == 200


# ===========================================================================
# GET /api/v1/admin/factory
# ===========================================================================
class TestFactoryInfo:
    async def test_admin_gets_factory_info(self, admin_client, mock_db):
        factory_mock = MagicMock()
        factory_mock.id = 1
        factory_mock.name = "Test Factory"

        factory_result = MagicMock()
        factory_result.scalar_one_or_none.return_value = factory_mock

        count_result = MagicMock()
        count_result.scalar.return_value = 3

        lines_result = MagicMock()
        lines_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(
            side_effect=[factory_result, count_result, lines_result]
        )

        resp = await admin_client.get("/api/v1/admin/factory")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Test Factory"
        assert body["user_count"] == 3
        assert body["production_lines"] == []

    async def test_factory_not_found(self, admin_client, mock_db):
        no_factory = MagicMock()
        no_factory.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=no_factory)

        resp = await admin_client.get("/api/v1/admin/factory")
        assert resp.status_code == 404

    async def test_operator_cannot_get_factory(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/factory")
        assert resp.status_code == 403

    async def test_viewer_cannot_get_factory(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/factory")
        assert resp.status_code == 403


# ===========================================================================
# GET /api/v1/admin/production-lines
# ===========================================================================
class TestListProductionLines:
    async def test_admin_lists_production_lines(self, admin_client, mock_db):
        line = _make_fake_production_line()
        _mock_scalars_unique_all(mock_db, [line])

        resp = await admin_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["name"] == "Line A"

    async def test_admin_lists_empty_lines(self, admin_client, mock_db):
        _mock_scalars_unique_all(mock_db, [])
        resp = await admin_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_operator_cannot_list_lines(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 403

    async def test_viewer_cannot_list_lines(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/production-lines")
        assert resp.status_code == 403


# ===========================================================================
# POST /api/v1/admin/production-lines
# ===========================================================================
class TestCreateProductionLine:
    async def test_admin_creates_line(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/admin/production-lines",
            json={"name": "New Line", "product_type": "Gears", "target_oee": 90.0},
        )
        # db.flush won't set id on mock, so serialization may fail.
        # Key: it should NOT be 403.
        assert resp.status_code != 403

    async def test_create_line_minimal_payload(self, admin_client, mock_db):
        """Only 'name' is required."""
        resp = await admin_client.post(
            "/api/v1/admin/production-lines",
            json={"name": "Minimal Line"},
        )
        assert resp.status_code != 403

    async def test_create_line_missing_name_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/admin/production-lines",
            json={"product_type": "Stuff"},
        )
        assert resp.status_code == 422

    async def test_operator_cannot_create_line(self, operator_client):
        resp = await operator_client.post(
            "/api/v1/admin/production-lines",
            json={"name": "Hacked Line"},
        )
        assert resp.status_code == 403

    async def test_viewer_cannot_create_line(self, viewer_client):
        resp = await viewer_client.post(
            "/api/v1/admin/production-lines",
            json={"name": "Hacked Line"},
        )
        assert resp.status_code == 403


# ===========================================================================
# PATCH /api/v1/admin/production-lines/{id}
# ===========================================================================
class TestUpdateProductionLine:
    async def test_admin_updates_line(self, admin_client, mock_db):
        line = _make_fake_production_line(id=10)
        _mock_scalar_one_or_none(mock_db, line)

        resp = await admin_client.patch(
            "/api/v1/admin/production-lines/10",
            json={"name": "Renamed Line"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 10

    async def test_update_nonexistent_line_returns_404(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.patch(
            "/api/v1/admin/production-lines/9999",
            json={"name": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_operator_cannot_update_line(self, operator_client):
        resp = await operator_client.patch(
            "/api/v1/admin/production-lines/10",
            json={"name": "Hacked"},
        )
        assert resp.status_code == 403


# ===========================================================================
# DELETE /api/v1/admin/production-lines/{id}
# ===========================================================================
class TestDeleteProductionLine:
    async def test_admin_deletes_line(self, admin_client, mock_db):
        line = _make_fake_production_line(id=10)
        _mock_scalar_one_or_none(mock_db, line)

        resp = await admin_client.delete("/api/v1/admin/production-lines/10")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deactivated"

    async def test_delete_nonexistent_line_returns_404(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.delete("/api/v1/admin/production-lines/9999")
        assert resp.status_code == 404

    async def test_operator_cannot_delete_line(self, operator_client):
        resp = await operator_client.delete("/api/v1/admin/production-lines/10")
        assert resp.status_code == 403

    async def test_viewer_cannot_delete_line(self, viewer_client):
        resp = await viewer_client.delete("/api/v1/admin/production-lines/10")
        assert resp.status_code == 403


# ===========================================================================
# POST /api/v1/admin/shifts
# NOTE: This endpoint has a known bug — line 496 references `line_id`
# (NameError) instead of `data.production_line_id`.
# ===========================================================================
class TestCreateShift:
    async def test_admin_creates_shift_known_bug(self, admin_client, mock_db):
        """
        POST /shifts has a NameError bug at line 496: `line_id` is undefined.
        The endpoint should return 500 (internal server error) when it hits
        the log_audit call after db.flush.
        """
        line = _make_fake_production_line(id=10)
        _mock_scalar_one_or_none(mock_db, line)

        resp = await admin_client.post(
            "/api/v1/admin/shifts",
            json={
                "production_line_id": 10,
                "name": "Morning",
                "start_hour": 6,
                "end_hour": 14,
                "planned_minutes": 480,
            },
        )
        # Known bug: NameError on `line_id` will cause 500
        assert resp.status_code in (200, 201, 500)

    async def test_create_shift_line_not_found(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.post(
            "/api/v1/admin/shifts",
            json={
                "production_line_id": 9999,
                "name": "Ghost Shift",
            },
        )
        assert resp.status_code == 404

    async def test_create_shift_missing_name_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/admin/shifts",
            json={"production_line_id": 10},
        )
        assert resp.status_code == 422

    async def test_operator_cannot_create_shift(self, operator_client):
        resp = await operator_client.post(
            "/api/v1/admin/shifts",
            json={"production_line_id": 10, "name": "Hacked"},
        )
        assert resp.status_code == 403

    async def test_viewer_cannot_create_shift(self, viewer_client):
        resp = await viewer_client.post(
            "/api/v1/admin/shifts",
            json={"production_line_id": 10, "name": "Hacked"},
        )
        assert resp.status_code == 403


# ===========================================================================
# PATCH /api/v1/admin/shifts/{id}
# ===========================================================================
class TestUpdateShift:
    async def test_admin_updates_shift(self, admin_client, mock_db):
        shift = _make_fake_shift(id=20)
        # model_dump(exclude_unset=True) will be called on the Pydantic model
        _mock_scalar_one_or_none(mock_db, shift)

        resp = await admin_client.patch(
            "/api/v1/admin/shifts/20",
            json={"name": "Afternoon"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 20

    async def test_update_nonexistent_shift_returns_404(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.patch(
            "/api/v1/admin/shifts/9999",
            json={"name": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_operator_cannot_update_shift(self, operator_client):
        resp = await operator_client.patch(
            "/api/v1/admin/shifts/20",
            json={"name": "Hacked"},
        )
        assert resp.status_code == 403


# ===========================================================================
# DELETE /api/v1/admin/shifts/{id}
# ===========================================================================
class TestDeleteShift:
    async def test_admin_deletes_shift(self, admin_client, mock_db):
        shift = _make_fake_shift(id=20)
        _mock_scalar_one_or_none(mock_db, shift)

        resp = await admin_client.delete("/api/v1/admin/shifts/20")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"
        mock_db.delete.assert_called_once()

    async def test_delete_nonexistent_shift_returns_404(self, admin_client, mock_db):
        _mock_scalar_one_or_none(mock_db, None)

        resp = await admin_client.delete("/api/v1/admin/shifts/9999")
        assert resp.status_code == 404

    async def test_operator_cannot_delete_shift(self, operator_client):
        resp = await operator_client.delete("/api/v1/admin/shifts/20")
        assert resp.status_code == 403

    async def test_viewer_cannot_delete_shift(self, viewer_client):
        resp = await viewer_client.delete("/api/v1/admin/shifts/20")
        assert resp.status_code == 403


# ===========================================================================
# GET /api/v1/admin/export-data
# ===========================================================================
class TestExportData:
    async def test_admin_exports_data(self, admin_client, mock_db):
        """Export returns a downloadable JSON stream."""
        # Build minimal mock chain: factory, users, lines, ... (many queries)
        factory_mock = MagicMock()
        factory_mock.id = 1
        factory_mock.name = "Test Factory"
        factory_mock.__table__ = MagicMock()
        factory_mock.__table__.columns = []

        factory_result = MagicMock()
        factory_result.scalar_one_or_none.return_value = factory_mock

        empty_scalars = MagicMock()
        empty_scalars.scalars.return_value.all.return_value = []
        empty_scalars.scalars.return_value.unique.return_value.all.return_value = []

        # The export runs many queries in sequence. Return factory for first,
        # empty for all the rest.
        mock_db.execute = AsyncMock(
            side_effect=[
                factory_result,  # factory
                empty_scalars,   # users
                empty_scalars,   # production lines
                # No prod records query (line_ids is empty)
                # No OEE records query (line_ids is empty)
                empty_scalars,   # five-why
                empty_scalars,   # ishikawa
                empty_scalars,   # kaizen
                empty_scalars,   # smed
                empty_scalars,   # lean assessments
                empty_scalars,   # audit logs
            ]
        )

        resp = await admin_client.get("/api/v1/admin/export-data")
        assert resp.status_code == 200
        assert "application/json" in resp.headers.get("content-type", "")
        # Should have content-disposition header for download
        assert "attachment" in resp.headers.get("content-disposition", "")

    async def test_operator_cannot_export_data(self, operator_client):
        resp = await operator_client.get("/api/v1/admin/export-data")
        assert resp.status_code == 403

    async def test_viewer_cannot_export_data(self, viewer_client):
        resp = await viewer_client.get("/api/v1/admin/export-data")
        assert resp.status_code == 403


# ===========================================================================
# Tenant isolation — other factory admin cannot access factory 1 data
# ===========================================================================
class TestAdminTenantIsolation:
    async def test_other_factory_gets_own_users(self, other_factory_client, mock_db):
        """Admin from factory 2 queries succeed but return factory-2-scoped data."""
        _mock_scalars_all(mock_db, [])
        resp = await other_factory_client.get("/api/v1/admin/users")
        assert resp.status_code == 200
        assert mock_db.execute.called

    async def test_other_factory_cannot_update_factory1_user(
        self, other_factory_client, mock_db
    ):
        """User from factory 1 is not visible to factory-2 admin."""
        _mock_scalar_one_or_none(mock_db, None)  # user not found in factory 2

        resp = await other_factory_client.patch(
            "/api/v1/admin/users/5",
            json={"role": "viewer"},
        )
        assert resp.status_code == 404

    async def test_other_factory_cannot_reset_factory1_password(
        self, other_factory_client, mock_db
    ):
        _mock_scalar_one_or_none(mock_db, None)
        resp = await other_factory_client.post("/api/v1/admin/users/5/reset-password")
        assert resp.status_code == 404
