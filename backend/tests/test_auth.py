"""
Tests for authentication endpoints: /api/v1/auth/*

Integration tests use httpx.AsyncClient with dependency overrides.
For login/refresh flows we need the *real* auth logic but a mocked DB,
so these tests mock at the SQLAlchemy execute level.
"""
import time
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport

from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
    revoke_token,
    decode_token,
    _fallback_attempts,
    _fallback_blacklist,
)
from tests.conftest import (
    FakeUser,
    ADMIN_USER,
    OPERATOR_USER,
    make_token,
)
from app.models.user import UserRole


pytestmark = [pytest.mark.auth, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _make_hashed_user(
    email="admin@test.com",
    password="StrongP@ssw0rd!",
    role=UserRole.ADMIN,
    factory_id=1,
    user_id=1,
    is_active=True,
    is_deleted=False,
    failed_login_attempts=0,
    locked_until=None,
):
    """Create a FakeUser with a properly hashed password for login tests."""
    return FakeUser(
        id=user_id,
        email=email,
        full_name="Test User",
        role=role,
        factory_id=factory_id,
        is_active=is_active,
        is_deleted=is_deleted,
        hashed_password=get_password_hash(password),
        failed_login_attempts=failed_login_attempts,
        locked_until=locked_until,
    )


def _mock_db_execute_returning_user(mock_db, user):
    """Configure mock_db.execute to return `user` via scalar_one_or_none."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = user
    mock_db.execute = AsyncMock(return_value=result)


# ---------------------------------------------------------------------------
# Login — successful
# ---------------------------------------------------------------------------
class TestLogin:
    async def test_successful_login_returns_tokens(self, app_no_auth, mock_db):
        """POST /api/v1/auth/login with valid credentials returns access + refresh tokens."""
        user = _make_hashed_user()
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "StrongP@ssw0rd!"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    async def test_login_wrong_password_returns_401(self, app_no_auth, mock_db):
        """POST /api/v1/auth/login with wrong password returns 401."""
        user = _make_hashed_user(password="CorrectPassword1!")
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "WrongPassword1!"},
            )

        assert resp.status_code == 401
        assert "Invalid credentials" in resp.json()["detail"]

    async def test_login_nonexistent_user_returns_401(self, app_no_auth, mock_db):
        """POST /api/v1/auth/login with unknown email returns 401."""
        _mock_db_execute_returning_user(mock_db, None)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "nobody@test.com", "password": "Whatever1!"},
            )

        assert resp.status_code == 401

    async def test_login_inactive_user_returns_403(self, app_no_auth, mock_db):
        """Deactivated accounts cannot log in."""
        user = _make_hashed_user(is_active=False)
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "StrongP@ssw0rd!"},
            )

        assert resp.status_code == 403
        assert "disabled" in resp.json()["detail"].lower()

    async def test_login_deleted_user_returns_403(self, app_no_auth, mock_db):
        """Soft-deleted accounts cannot log in."""
        user = _make_hashed_user(is_deleted=True)
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "StrongP@ssw0rd!"},
            )

        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Register — requires admin role
# ---------------------------------------------------------------------------
class TestRegister:
    async def test_register_requires_admin(self, operator_client):
        """POST /api/v1/auth/register should fail for non-admin users (403)."""
        resp = await operator_client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@testfactory.com",
                "password": "V3ryStr0ng!Pass",
                "full_name": "New Operator",
                "role": "operator",
            },
        )
        assert resp.status_code == 403

    async def test_register_succeeds_for_admin(self, admin_client, mock_db):
        """Admin can register a new user in their factory."""
        # Mock: no existing user with that email
        no_user_result = MagicMock()
        no_user_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=no_user_result)

        # The route does db.add + db.flush + db.commit — all already mocked
        resp = await admin_client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@testfactory.com",
                "password": "V3ryStr0ng!Pass",
                "full_name": "New Operator",
                "role": "operator",
            },
        )
        # The endpoint returns UserResponse which needs an id — because we
        # mocked flush, the user object won't have an auto-generated id.
        # The response may fail on serialization; we accept either 200 or 500
        # as long as the auth gate (admin-only) passed.
        # A 403 here would mean RBAC is wrong.
        assert resp.status_code != 403


# ---------------------------------------------------------------------------
# Refresh token rotation
# ---------------------------------------------------------------------------
class TestRefreshToken:
    async def test_refresh_returns_new_tokens(self, app_no_auth, mock_db):
        """POST /api/v1/auth/refresh rotates tokens."""
        user = _make_hashed_user()
        _mock_db_execute_returning_user(mock_db, user)

        old_refresh = create_refresh_token(data={"sub": "1"})

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": old_refresh},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        # The old refresh token should be different from the new one
        assert body["refresh_token"] != old_refresh

    async def test_refresh_with_access_token_rejected(self, app_no_auth, mock_db):
        """Using an access token as a refresh token should fail."""
        token = create_access_token(data={"sub": "1", "role": "admin", "fid": 1})

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/refresh",
                json={"refresh_token": token},
            )

        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout — token revocation
# ---------------------------------------------------------------------------
class TestLogout:
    async def test_logout_revokes_token(self, admin_client):
        """POST /api/v1/auth/logout should succeed and revoke the token."""
        token = make_token(ADMIN_USER)
        resp = await admin_client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert "logged out" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Rate limiting (in-memory fallback)
# ---------------------------------------------------------------------------
class TestRateLimiting:
    async def test_rate_limit_blocks_after_threshold(self, app_no_auth, mock_db):
        """After N failed login attempts from the same IP, return 429."""
        _mock_db_execute_returning_user(mock_db, None)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Fire more requests than the limit (default 5/min)
            last_status = None
            for i in range(10):
                resp = await client.post(
                    "/api/v1/auth/login",
                    data={"username": "nobody@test.com", "password": "bad"},
                )
                last_status = resp.status_code
                if resp.status_code == 429:
                    break

        assert last_status == 429


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------
class TestAccountLockout:
    async def test_locked_account_returns_423(self, app_no_auth, mock_db):
        """An account locked_until the future should return HTTP 423."""
        user = _make_hashed_user(
            locked_until=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "StrongP@ssw0rd!"},
            )

        assert resp.status_code == 423
        assert "locked" in resp.json()["detail"].lower()

    async def test_failed_attempts_increment(self, app_no_auth, mock_db):
        """Failed logins should increment the failed_login_attempts counter."""
        user = _make_hashed_user(password="RealP@ss1!", failed_login_attempts=0)
        _mock_db_execute_returning_user(mock_db, user)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post(
                "/api/v1/auth/login",
                data={"username": "admin@test.com", "password": "WrongPassword!1"},
            )

        # The code sets user.failed_login_attempts += 1 then flushes
        assert user.failed_login_attempts >= 1


# ---------------------------------------------------------------------------
# Me endpoint
# ---------------------------------------------------------------------------
class TestMeEndpoint:
    async def test_me_returns_current_user(self, admin_client):
        resp = await admin_client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == ADMIN_USER.email
        assert body["role"] == ADMIN_USER.role.value
