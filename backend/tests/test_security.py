"""
Security tests for LeanPilot backend.

Covers:
- Password strength validation
- JWT token expiry and revocation
- CORS headers
- Security headers (X-Frame-Options, etc.)
"""
import time
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from jose import jwt

from app.core.config import get_settings
from app.core.security import (
    validate_password_strength,
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    revoke_token,
    _is_token_revoked,
    _fallback_blacklist,
)
from tests.conftest import ADMIN_USER, make_token


settings = get_settings()

pytestmark = [pytest.mark.security]


# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
class TestPasswordValidation:
    """Tests for validate_password_strength."""

    def test_strong_password_passes(self):
        errors = validate_password_strength("C0mpl3x!Pass#")
        assert errors == []

    def test_too_short(self):
        errors = validate_password_strength("Sh0rt!")
        assert any("at least" in e for e in errors)

    def test_no_uppercase(self):
        errors = validate_password_strength("alllowercase1!xx")
        assert any("uppercase" in e.lower() for e in errors)

    def test_no_lowercase(self):
        errors = validate_password_strength("ALLUPPERCASE1!XX")
        assert any("lowercase" in e.lower() for e in errors)

    def test_no_digit(self):
        errors = validate_password_strength("NoDigitsHere!xx")
        assert any("digit" in e.lower() for e in errors)

    def test_no_special_character(self):
        errors = validate_password_strength("NoSpecial1chars")
        assert any("special" in e.lower() for e in errors)

    def test_empty_password_has_all_errors(self):
        errors = validate_password_strength("")
        # At minimum: too short, no upper, no lower, no digit, no special
        assert len(errors) >= 4

    def test_common_weak_password(self):
        errors = validate_password_strength("password")
        assert len(errors) > 0

    def test_password_with_only_numbers(self):
        errors = validate_password_strength("123456789012")
        assert any("uppercase" in e.lower() for e in errors)
        assert any("lowercase" in e.lower() for e in errors)
        assert any("special" in e.lower() for e in errors)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
class TestPasswordHashing:
    """bcrypt hash + verify round-trip."""

    def test_hash_and_verify_correct(self):
        raw = "MyS3cur3P@ss!"
        hashed = get_password_hash(raw)
        assert verify_password(raw, hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("Correct1!")
        assert verify_password("Wrong1!", hashed) is False

    def test_hash_is_not_plaintext(self):
        raw = "MyS3cur3P@ss!"
        hashed = get_password_hash(raw)
        assert hashed != raw
        assert hashed.startswith("$2")  # bcrypt prefix


# ---------------------------------------------------------------------------
# Token creation and decoding
# ---------------------------------------------------------------------------
class TestTokens:
    """JWT creation, decoding, type enforcement."""

    def test_access_token_contains_correct_claims(self):
        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert payload["fid"] == 1
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "jti" in payload

    def test_refresh_token_contains_correct_claims(self):
        token = create_refresh_token(data={"sub": "42"})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == "42"
        assert payload["type"] == "refresh"
        assert "jti" in payload

    @pytest.mark.asyncio
    async def test_decode_access_token(self):
        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})
        payload = await decode_token(token, expected_type="access")
        assert payload["sub"] == "42"

    @pytest.mark.asyncio
    async def test_decode_refresh_token(self):
        token = create_refresh_token(data={"sub": "42"})
        payload = await decode_token(token, expected_type="refresh")
        assert payload["sub"] == "42"

    @pytest.mark.asyncio
    async def test_decode_access_as_refresh_fails(self):
        """Using an access token where a refresh is expected should raise."""
        from fastapi import HTTPException

        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})
        with pytest.raises(HTTPException) as exc_info:
            await decode_token(token, expected_type="refresh")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_decode_refresh_as_access_fails(self):
        from fastapi import HTTPException

        token = create_refresh_token(data={"sub": "42"})
        with pytest.raises(HTTPException) as exc_info:
            await decode_token(token, expected_type="access")
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Expired token
# ---------------------------------------------------------------------------
class TestExpiredToken:
    @pytest.mark.asyncio
    async def test_expired_access_token_rejected(self):
        """A token with exp in the past should be rejected."""
        from fastapi import HTTPException

        token = create_access_token(
            data={"sub": "42", "role": "admin", "fid": 1},
            expires_delta=timedelta(seconds=-10),  # Already expired
        )
        with pytest.raises(HTTPException) as exc_info:
            await decode_token(token, expected_type="access")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_tampered_token_rejected(self):
        """A token signed with a different key should be rejected."""
        from fastapi import HTTPException

        fake_token = jwt.encode(
            {"sub": "42", "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret-key",
            algorithm="HS256",
        )
        with pytest.raises(HTTPException):
            await decode_token(fake_token, expected_type="access")


# ---------------------------------------------------------------------------
# Revoked token
# ---------------------------------------------------------------------------
class TestRevokedToken:
    @pytest.mark.asyncio
    async def test_revoke_then_decode_fails(self):
        """A revoked token (JTI in blacklist) should be rejected on decode."""
        from fastapi import HTTPException

        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})

        # Revoke it
        await revoke_token(token)

        # Now decoding should fail
        with pytest.raises(HTTPException) as exc_info:
            await decode_token(token, expected_type="access")
        assert exc_info.value.status_code == 401
        assert "revoked" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_is_token_revoked_after_revocation(self):
        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        jti = payload["jti"]

        assert await _is_token_revoked(jti) is False
        await revoke_token(token)
        assert await _is_token_revoked(jti) is True

    @pytest.mark.asyncio
    async def test_non_revoked_token_passes(self):
        token = create_access_token(data={"sub": "42", "role": "admin", "fid": 1})
        payload = await decode_token(token, expected_type="access")
        assert payload["sub"] == "42"


# ---------------------------------------------------------------------------
# Security headers (middleware)
# ---------------------------------------------------------------------------
class TestSecurityHeaders:
    """Verify the SecurityHeadersMiddleware adds required headers."""

    async def test_x_frame_options(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.headers.get("X-Frame-Options") == "DENY"

    async def test_x_content_type_options(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"

    async def test_x_xss_protection(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.headers.get("X-XSS-Protection") == "1; mode=block"

    async def test_referrer_policy(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    async def test_cache_control(self, admin_client):
        resp = await admin_client.get("/api/health")
        cache = resp.headers.get("Cache-Control", "")
        assert "no-store" in cache
        assert "no-cache" in cache


# ---------------------------------------------------------------------------
# CORS headers
# ---------------------------------------------------------------------------
class TestCORS:
    """Verify CORS middleware is configured."""

    async def test_cors_allows_configured_origin(self, admin_client):
        """An OPTIONS preflight from an allowed origin should succeed."""
        resp = await admin_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # CORS middleware should respond (200 or 204) with allow-origin
        assert resp.status_code in (200, 204)
        assert "access-control-allow-origin" in resp.headers

    async def test_cors_allows_credentials(self, admin_client):
        resp = await admin_client.options(
            "/api/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        allow_creds = resp.headers.get("access-control-allow-credentials", "")
        assert allow_creds.lower() == "true"


# ---------------------------------------------------------------------------
# Email masking (audit log helper)
# ---------------------------------------------------------------------------
class TestEmailMasking:
    """Test the _mask_email helper used in audit logs."""

    def test_standard_email(self):
        from app.core.security import _mask_email

        masked = _mask_email("john@example.com")
        assert masked == "j***n@example.com"

    def test_short_local_part(self):
        from app.core.security import _mask_email

        masked = _mask_email("ab@example.com")
        assert "***" in masked
        assert "@example.com" in masked

    def test_single_char_local(self):
        from app.core.security import _mask_email

        masked = _mask_email("a@example.com")
        assert "***" in masked

    def test_empty_email(self):
        from app.core.security import _mask_email

        assert _mask_email("") == "***"

    def test_no_at_sign(self):
        from app.core.security import _mask_email

        assert _mask_email("invalid") == "***"
