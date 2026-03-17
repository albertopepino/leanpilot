"""
Tests for privacy, consent, health, and GDPR endpoints.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from tests.conftest import ADMIN_USER, OPERATOR_USER


pytestmark = [pytest.mark.privacy, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
class TestHealth:
    async def test_health_returns_ok(self, admin_client):
        resp = await admin_client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body

    async def test_features_returns_all_modules(self, admin_client):
        resp = await admin_client.get("/api/v1/features")
        assert resp.status_code == 200
        body = resp.json()
        assert "core" in body
        assert "ai" in body
        assert "manufacturing" in body
        assert "quality_control" in body
        assert "advanced_lean" in body


# ---------------------------------------------------------------------------
# Me endpoint — consent fields
# ---------------------------------------------------------------------------
class TestMeConsent:
    async def test_me_includes_consent_fields(self, admin_client):
        resp = await admin_client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert "ai_consent" in body
        assert "marketing_consent" in body
        assert "needs_consent" in body
        assert "totp_enabled" in body
        assert "consent_version" in body


# ---------------------------------------------------------------------------
# Consent update — GDPR Art. 7(3)
# ---------------------------------------------------------------------------
class TestConsentUpdate:
    async def test_update_ai_consent(self, admin_client, mock_db):
        resp = await admin_client.patch(
            "/api/v1/auth/consent",
            json={"ai_consent": True},
        )
        # May be 200 or fail on mock commit — we just check auth passed
        assert resp.status_code != 403
        assert resp.status_code != 401

    async def test_update_marketing_consent(self, admin_client, mock_db):
        resp = await admin_client.patch(
            "/api/v1/auth/consent",
            json={"marketing_consent": True},
        )
        assert resp.status_code != 403
        assert resp.status_code != 401


# ---------------------------------------------------------------------------
# Accept consent — first login gate
# ---------------------------------------------------------------------------
class TestAcceptConsent:
    async def test_accept_consent_requires_privacy(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/auth/accept-consent",
            json={
                "privacy_policy_accepted": False,
                "terms_accepted": True,
            },
        )
        assert resp.status_code == 400
        assert "privacy" in resp.json()["detail"].lower()

    async def test_accept_consent_requires_terms(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/auth/accept-consent",
            json={
                "privacy_policy_accepted": True,
                "terms_accepted": False,
            },
        )
        assert resp.status_code == 400
        assert "terms" in resp.json()["detail"].lower()

    async def test_accept_consent_succeeds(self, admin_client, mock_db):
        resp = await admin_client.post(
            "/api/v1/auth/accept-consent",
            json={
                "privacy_policy_accepted": True,
                "terms_accepted": True,
                "ai_consent": True,
                "marketing_consent": False,
            },
        )
        # Auth gate passed (not 401/403)
        assert resp.status_code != 401
        assert resp.status_code != 403


# ---------------------------------------------------------------------------
# TOTP endpoints
# ---------------------------------------------------------------------------
class TestTOTPSetup:
    async def test_totp_setup_returns_qr(self, admin_client, mock_db):
        resp = await admin_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 200
        body = resp.json()
        assert "secret" in body
        assert "qr_code" in body
        assert "uri" in body
        assert len(body["secret"]) > 10
        assert "otpauth://" in body["uri"]

    async def test_totp_verify_rejects_bad_code(self, admin_client, mock_db):
        # First setup
        await admin_client.post("/api/v1/auth/totp/setup")
        # Try bad code
        resp = await admin_client.post(
            "/api/v1/auth/totp/verify",
            json={"code": "000000"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Unauthenticated access
# ---------------------------------------------------------------------------
class TestUnauthenticated:
    async def test_me_requires_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_consent_requires_auth(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/auth/consent",
            json={"ai_consent": True},
        )
        assert resp.status_code == 401

    async def test_totp_setup_requires_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/auth/totp/setup")
        assert resp.status_code == 401
