"""
Tests for the /api/health endpoint.

The health endpoint is public (no auth required) and returns system status.
"""
import pytest
from httpx import AsyncClient, ASGITransport


pytestmark = [pytest.mark.health, pytest.mark.integration]


class TestHealthEndpoint:
    """Tests for GET /api/health."""

    async def test_health_returns_200(self, app_no_auth):
        """GET /api/health should return 200 with status info."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/health")

        assert resp.status_code == 200
        body = resp.json()
        assert "status" in body
        assert body["status"] in ("ok", "degraded")

    async def test_health_includes_version(self, app_no_auth):
        """GET /api/health should include the app version."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/health")

        body = resp.json()
        assert "version" in body
        assert isinstance(body["version"], str)

    async def test_health_includes_database_status(self, app_no_auth):
        """GET /api/health should report database connectivity."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/health")

        body = resp.json()
        assert "database" in body
        assert body["database"] in ("connected", "unavailable")

    async def test_health_includes_ai_module_flag(self, app_no_auth):
        """GET /api/health should report whether the AI module is enabled."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/health")

        body = resp.json()
        assert "ai_module" in body
        assert isinstance(body["ai_module"], bool)

    async def test_health_no_auth_required(self, app_no_auth):
        """GET /api/health should not require authentication."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # No Authorization header
            resp = await client.get("/api/health")

        # Should NOT return 401 or 403
        assert resp.status_code == 200


class TestFeaturesEndpoint:
    """Tests for GET /api/v1/features (also public)."""

    async def test_features_returns_200(self, app_no_auth):
        """GET /api/v1/features should return 200 with feature flags."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/features")

        assert resp.status_code == 200
        body = resp.json()
        assert "core" in body
        assert "advanced_lean" in body
        assert "manufacturing" in body

    async def test_features_no_auth_required(self, app_no_auth):
        """GET /api/v1/features should not require authentication."""
        transport = ASGITransport(app=app_no_auth)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/v1/features")

        assert resp.status_code == 200
