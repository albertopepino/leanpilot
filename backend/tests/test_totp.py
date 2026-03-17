"""
Tests for TOTP (2FA) endpoints: /api/v1/auth/totp/*

Covers all 4 TOTP endpoints with happy-path, error, and edge-case scenarios.
Uses pyotp to generate valid TOTP codes for verification tests.
"""
import time
import pytest
import pyotp
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport

from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from tests.conftest import (
    FakeUser,
    ADMIN_USER,
    OPERATOR_USER,
    VIEWER_USER,
    make_token,
)
from app.models.user import UserRole


pytestmark = [pytest.mark.totp, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TOTP_SECRET = pyotp.random_base32()


def _make_totp_user(
    *,
    totp_enabled: bool = False,
    totp_secret: str | None = None,
    password: str = "StrongP@ssw0rd!",
    user_id: int = 1,
    role: UserRole = UserRole.ADMIN,
    factory_id: int = 1,
    is_active: bool = True,
    is_deleted: bool = False,
):
    """Create a FakeUser with TOTP-related attributes."""
    user = FakeUser(
        id=user_id,
        email="totp@testfactory.com",
        full_name="TOTP User",
        role=role,
        factory_id=factory_id,
        is_active=is_active,
        is_deleted=is_deleted,
        hashed_password=get_password_hash(password),
    )
    # Add TOTP attributes (not in FakeUser.__init__)
    user.totp_enabled = totp_enabled
    user.totp_secret = totp_secret
    return user


def _mock_scalar_one_or_none(mock_db, obj):
    result = MagicMock()
    result.scalar_one_or_none.return_value = obj
    mock_db.execute = AsyncMock(return_value=result)


def _make_2fa_pending_token(user_id: int) -> str:
    """Create a 2fa_pending temp token for the validate endpoint."""
    from app.core.config import get_settings
    from jose import jwt
    from datetime import datetime, timedelta, timezone

    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "2fa_pending",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _make_expired_2fa_token(user_id: int) -> str:
    """Create an already-expired 2fa_pending token."""
    from app.core.config import get_settings
    from jose import jwt

    settings = get_settings()
    expire = datetime.now(timezone.utc) - timedelta(minutes=1)
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "2fa_pending",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ===========================================================================
# POST /api/v1/auth/totp/setup
# ===========================================================================
class TestTOTPSetup:
    async def test_setup_returns_secret_and_qr(self, admin_client, mock_db):
        """Setup should return a TOTP secret, QR code (base64), and URI."""
        # The admin_client fixture overrides get_current_user to return ADMIN_USER.
        # ADMIN_USER doesn't have totp_enabled, so we add it.
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

        resp = await admin_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 200
        body = resp.json()
        assert "secret" in body
        assert "qr_code" in body
        assert "uri" in body
        assert len(body["secret"]) > 0
        assert body["uri"].startswith("otpauth://totp/")
        assert "LeanPilot" in body["uri"]

    async def test_setup_fails_if_already_enabled(self, admin_client, mock_db):
        """If 2FA is already enabled, setup should return 400."""
        ADMIN_USER.totp_enabled = True
        ADMIN_USER.totp_secret = TOTP_SECRET

        resp = await admin_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 400
        assert "already enabled" in resp.json()["detail"]

        # Cleanup
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

    async def test_setup_stores_secret_on_user(self, admin_client, mock_db):
        """After setup, the user object should have a totp_secret set."""
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

        resp = await admin_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 200
        # The route sets current_user.totp_secret = secret
        assert ADMIN_USER.totp_secret is not None
        assert len(ADMIN_USER.totp_secret) > 0

        # Cleanup
        ADMIN_USER.totp_secret = None

    async def test_operator_can_setup_totp(self, operator_client, mock_db):
        """Any authenticated user (not just admin) can set up 2FA."""
        OPERATOR_USER.totp_enabled = False
        OPERATOR_USER.totp_secret = None

        resp = await operator_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 200

        # Cleanup
        OPERATOR_USER.totp_secret = None


# ===========================================================================
# POST /api/v1/auth/totp/verify
# ===========================================================================
class TestTOTPVerify:
    async def test_verify_with_correct_code(self, admin_client, mock_db):
        """Verifying with a correct TOTP code enables 2FA."""
        secret = pyotp.random_base32()
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = secret

        totp = pyotp.TOTP(secret)
        code = totp.now()

        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": code},
        )
        assert resp.status_code == 200
        assert "enabled" in resp.json()["detail"].lower()
        assert ADMIN_USER.totp_enabled is True

        # Cleanup
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

    async def test_verify_with_wrong_code(self, admin_client, mock_db):
        """Wrong TOTP code should return 400."""
        secret = pyotp.random_base32()
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = secret

        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": "000000"},
        )
        assert resp.status_code == 400
        assert "Invalid TOTP code" in resp.json()["detail"]
        assert ADMIN_USER.totp_enabled is not True

        # Cleanup
        ADMIN_USER.totp_secret = None

    async def test_verify_without_setup_first(self, admin_client, mock_db):
        """If no secret exists (setup not called), verify should fail."""
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": "123456"},
        )
        assert resp.status_code == 400
        assert "Run /setup first" in resp.json()["detail"]

    async def test_verify_when_already_enabled(self, admin_client, mock_db):
        """If 2FA is already enabled, verify should return 400."""
        ADMIN_USER.totp_enabled = True
        ADMIN_USER.totp_secret = TOTP_SECRET

        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": "123456"},
        )
        assert resp.status_code == 400
        assert "already enabled" in resp.json()["detail"]

        # Cleanup
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

    async def test_verify_missing_code_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={},
        )
        assert resp.status_code == 422


# ===========================================================================
# POST /api/v1/auth/totp/disable
# ===========================================================================
class TestTOTPDisable:
    async def test_disable_with_correct_password_and_code(self, admin_client, mock_db):
        """Disabling 2FA requires correct password + valid TOTP code."""
        secret = pyotp.random_base32()
        password = "StrongP@ssw0rd!"
        ADMIN_USER.totp_enabled = True
        ADMIN_USER.totp_secret = secret
        ADMIN_USER.hashed_password = get_password_hash(password)

        totp = pyotp.TOTP(secret)
        code = totp.now()

        resp = await admin_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": password, "code": code},
        )
        assert resp.status_code == 200
        assert "disabled" in resp.json()["detail"].lower()
        assert ADMIN_USER.totp_enabled is False
        assert ADMIN_USER.totp_secret is None

    async def test_disable_with_wrong_password(self, admin_client, mock_db):
        """Wrong password should be rejected."""
        secret = pyotp.random_base32()
        ADMIN_USER.totp_enabled = True
        ADMIN_USER.totp_secret = secret
        ADMIN_USER.hashed_password = get_password_hash("RealPassword1!")

        totp = pyotp.TOTP(secret)
        code = totp.now()

        resp = await admin_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": "WrongPassword1!", "code": code},
        )
        assert resp.status_code == 400
        assert "Invalid password" in resp.json()["detail"]

        # Cleanup
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

    async def test_disable_with_wrong_totp_code(self, admin_client, mock_db):
        """Correct password but wrong TOTP code should be rejected."""
        secret = pyotp.random_base32()
        password = "StrongP@ssw0rd!"
        ADMIN_USER.totp_enabled = True
        ADMIN_USER.totp_secret = secret
        ADMIN_USER.hashed_password = get_password_hash(password)

        resp = await admin_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": password, "code": "000000"},
        )
        assert resp.status_code == 400
        assert "Invalid TOTP code" in resp.json()["detail"]

        # Cleanup
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

    async def test_disable_when_not_enabled(self, admin_client, mock_db):
        """Cannot disable 2FA if it is not enabled."""
        ADMIN_USER.totp_enabled = False
        ADMIN_USER.totp_secret = None

        resp = await admin_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": "anything", "code": "123456"},
        )
        assert resp.status_code == 400
        assert "not enabled" in resp.json()["detail"]

    async def test_disable_missing_fields_returns_422(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": "onlypass"},
        )
        assert resp.status_code == 422


# ===========================================================================
# POST /api/v1/auth/totp/validate
# ===========================================================================
class TestTOTPValidate:
    async def test_validate_with_valid_token_and_code(self, app_no_auth, mock_db):
        """Valid temp_token + correct TOTP code returns real access/refresh tokens."""
        secret = pyotp.random_base32()
        user = _make_totp_user(totp_enabled=True, totp_secret=secret)
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)
        totp = pyotp.TOTP(secret)
        code = totp.now()

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": code},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    async def test_validate_with_wrong_code(self, app_no_auth, mock_db):
        """Correct temp_token but wrong TOTP code returns 401."""
        secret = pyotp.random_base32()
        user = _make_totp_user(totp_enabled=True, totp_secret=secret)
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": "000000"},
            )

        assert resp.status_code == 401
        assert "Invalid TOTP code" in resp.json()["detail"]

    async def test_validate_with_expired_token(self, app_no_auth, mock_db):
        """Expired temp_token should fail with 401."""
        expired_token = _make_expired_2fa_token(user_id=1)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": expired_token, "code": "123456"},
            )

        assert resp.status_code == 401

    async def test_validate_with_invalid_token(self, app_no_auth, mock_db):
        """Completely invalid/garbage token should fail."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": "garbage.token.here", "code": "123456"},
            )

        assert resp.status_code == 401

    async def test_validate_inactive_user(self, app_no_auth, mock_db):
        """If user is inactive, validate should reject."""
        secret = pyotp.random_base32()
        user = _make_totp_user(
            totp_enabled=True, totp_secret=secret, is_active=False,
        )
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)
        totp = pyotp.TOTP(secret)
        code = totp.now()

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": code},
            )

        assert resp.status_code == 401

    async def test_validate_deleted_user(self, app_no_auth, mock_db):
        """Soft-deleted user should be rejected."""
        secret = pyotp.random_base32()
        user = _make_totp_user(
            totp_enabled=True, totp_secret=secret, is_deleted=True,
        )
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)
        totp = pyotp.TOTP(secret)
        code = totp.now()

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": code},
            )

        assert resp.status_code == 401

    async def test_validate_user_without_totp_enabled(self, app_no_auth, mock_db):
        """User exists but has totp_enabled=False should get 400."""
        secret = pyotp.random_base32()
        user = _make_totp_user(totp_enabled=False, totp_secret=secret)
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)
        totp = pyotp.TOTP(secret)
        code = totp.now()

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": code},
            )

        assert resp.status_code == 400
        assert "not enabled" in resp.json()["detail"]

    async def test_validate_user_not_found(self, app_no_auth, mock_db):
        """If user_id from token doesn't exist, should get 401."""
        _mock_scalar_one_or_none(mock_db, None)

        temp_token = _make_2fa_pending_token(user_id=9999)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": temp_token, "code": "123456"},
            )

        assert resp.status_code == 401

    async def test_validate_missing_fields_returns_422(self, app_no_auth, mock_db):
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": "something"},
            )

        assert resp.status_code == 422

    async def test_validate_no_rate_limiting_vulnerability(self, app_no_auth, mock_db):
        """
        KNOWN VULNERABILITY: The /validate endpoint does not implement
        rate limiting on TOTP code attempts. An attacker with a valid
        temp_token could brute-force 6-digit codes (1M possibilities).

        This test documents the vulnerability by confirming that multiple
        rapid failed attempts are all processed (no 429 returned).
        """
        secret = pyotp.random_base32()
        user = _make_totp_user(totp_enabled=True, totp_secret=secret)
        _mock_scalar_one_or_none(mock_db, user)

        temp_token = _make_2fa_pending_token(user.id)

        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            statuses = []
            for _ in range(5):
                resp = await client.post(
                    "/api/v1/auth/totp/validate",
                    json={"temp_token": temp_token, "code": "000000"},
                )
                statuses.append(resp.status_code)

        # All should be 401 (wrong code) — none should be 429 (rate limited)
        assert all(s == 401 for s in statuses), (
            f"Expected all 401s but got {statuses}. "
            "If 429 appears, rate limiting has been added (good!)."
        )


# ===========================================================================
# Cross-cutting: unauthenticated access to authenticated TOTP endpoints
# ===========================================================================
class TestTOTPRequiresAuth:
    async def test_setup_requires_auth(self, anon_client):
        """Setup endpoint requires authentication."""
        resp = await anon_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 401

    async def test_verify_requires_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": "123456"},
        )
        assert resp.status_code == 401

    async def test_disable_requires_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/auth/totp/disable",
            json={"password": "x", "code": "123456"},
        )
        assert resp.status_code == 401

    async def test_validate_does_not_require_auth(self, app_no_auth, mock_db):
        """
        The /validate endpoint intentionally does NOT require Bearer auth
        (it uses temp_token in the body instead). Sending a request without
        auth should not return 401 from an auth middleware — it should process
        the request body.
        """
        # Send with garbage temp_token — should fail on token decode (401),
        # not on missing auth header.
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/auth/totp/validate",
                json={"temp_token": "invalid", "code": "123456"},
            )
        # Should be 401 from decode_token, NOT from auth middleware
        assert resp.status_code == 401
