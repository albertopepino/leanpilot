"""
Tests for Company Settings endpoints: logo upload, delete, and serve.

- POST /api/v1/admin/company-logo  (admin only, multipart upload)
- DELETE /api/v1/admin/company-logo (admin only)
- GET /api/v1/company/logo          (any authenticated user)

Known issues documented via tests:
- SVG upload is allowed, creating a stored XSS vulnerability
- log_audit is called with `details=` kwarg instead of `detail=`
"""

import os
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from io import BytesIO

from tests.conftest import (
    ADMIN_USER,
    OPERATOR_USER,
    VIEWER_USER,
    OTHER_FACTORY_ADMIN,
)

pytestmark = [pytest.mark.company_settings, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_settings(**overrides):
    """Return a MagicMock that looks like a CompanySettings row."""
    defaults = dict(
        id=1, factory_id=1, logo_filename="factory_1_abc123.png",
        company_display_name=None,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


# ===========================================================================
# Upload Logo (POST /api/v1/admin/company-logo)
# ===========================================================================


class TestUploadCompanyLogo:
    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.path.exists", return_value=False)
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_upload_valid_png(
        self, mock_open, mock_makedirs, mock_exists, mock_audit, admin_client, mock_db,
    ):
        """Admin can upload a valid PNG logo."""
        # Mock: no existing settings
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("logo.png", BytesIO(png_bytes), "image/png")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)

        assert resp.status_code == 200
        body = resp.json()
        assert body["logo_url"] == "/api/v1/company/logo"
        assert "filename" in body
        # Verify db.add was called (new settings created)
        mock_db.add.assert_called_once()

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.path.exists", return_value=False)
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_upload_valid_jpeg(
        self, mock_open, mock_makedirs, mock_exists, mock_audit, admin_client, mock_db,
    ):
        """Admin can upload a valid JPEG logo."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        files = {"file": ("logo.jpg", BytesIO(jpeg_bytes), "image/jpeg")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)

        assert resp.status_code == 200

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_upload_svg_stored_xss_vulnerability(
        self, mock_open, mock_makedirs, mock_audit, admin_client, mock_db,
    ):
        """
        BUG / SECURITY: SVG files are allowed but can contain embedded JavaScript.
        This creates a stored XSS vulnerability when the logo is served to users.
        SVG with <script> tags will be stored and later served with image/svg+xml
        content type, allowing script execution in browsers.
        """
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        svg_xss_payload = b"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <script>alert('XSS')</script>
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>"""
        files = {"file": ("logo.svg", BytesIO(svg_xss_payload), "image/svg+xml")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)

        # SVG is accepted — this documents the vulnerability
        assert resp.status_code == 200

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.path.exists", return_value=True)
    @patch("os.remove")
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_upload_replaces_existing_logo(
        self, mock_open, mock_makedirs, mock_remove, mock_exists, mock_audit,
        admin_client, mock_db,
    ):
        """Uploading a new logo deletes the old file and updates settings."""
        old_settings = _fake_settings(logo_filename="old_logo.png")
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = old_settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("new_logo.png", BytesIO(png_bytes), "image/png")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)

        assert resp.status_code == 200
        # Old file should be removed
        mock_remove.assert_called_once()
        # Settings object should be updated (not a new one created)
        assert old_settings.logo_filename != "old_logo.png"

    async def test_upload_disallowed_type_returns_400(self, admin_client):
        """Uploading a non-image file (e.g., .exe) returns 400."""
        files = {"file": ("malware.exe", BytesIO(b"MZ" + b"\x00" * 100), "application/octet-stream")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["detail"].lower()

    async def test_upload_invalid_png_magic_bytes_returns_400(self, admin_client):
        """PNG content type but non-PNG magic bytes returns 400."""
        files = {"file": ("fake.png", BytesIO(b"NOT_PNG" + b"\x00" * 100), "image/png")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 400
        assert "Invalid PNG" in resp.json()["detail"]

    async def test_upload_invalid_jpeg_magic_bytes_returns_400(self, admin_client):
        """JPEG content type but non-JPEG magic bytes returns 400."""
        files = {"file": ("fake.jpg", BytesIO(b"NOT_JPEG" + b"\x00" * 100), "image/jpeg")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 400
        assert "Invalid JPEG" in resp.json()["detail"]

    async def test_upload_oversized_file_returns_400(self, admin_client):
        """File larger than 2 MB returns 400."""
        huge_content = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (3 * 1024 * 1024))
        files = {"file": ("huge.png", BytesIO(huge_content), "image/png")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 400
        assert "too large" in resp.json()["detail"].lower()

    async def test_upload_as_operator_returns_403(self, operator_client):
        """Non-admin users cannot upload logos (403)."""
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("logo.png", BytesIO(png_bytes), "image/png")}
        resp = await operator_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 403

    async def test_upload_as_viewer_returns_403(self, viewer_client):
        """Viewers cannot upload logos (403)."""
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("logo.png", BytesIO(png_bytes), "image/png")}
        resp = await viewer_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 403

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_upload_audit_log_uses_wrong_kwarg(
        self, mock_open, mock_makedirs, mock_audit, admin_client, mock_db,
    ):
        """
        BUG: log_audit is called with `details=` (plural) but the function
        signature expects `detail=` (singular). The detail message is silently
        lost because it goes into **kwargs.
        """
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("logo.png", BytesIO(png_bytes), "image/png")}
        resp = await admin_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 200

        # Verify log_audit was called
        mock_audit.assert_awaited_once()
        call_kwargs = mock_audit.call_args.kwargs
        # The route passes `details=` (plural) instead of `detail=` (singular).
        # This means the detail message is lost.
        assert "details" in call_kwargs, (
            "Expected the bug: route uses 'details' kwarg instead of 'detail'"
        )
        assert "detail" not in call_kwargs, (
            "If 'detail' is now used, the bug has been fixed"
        )


# ===========================================================================
# Delete Logo (DELETE /api/v1/admin/company-logo)
# ===========================================================================


class TestDeleteCompanyLogo:
    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.path.exists", return_value=True)
    @patch("os.remove")
    async def test_delete_logo_success(
        self, mock_remove, mock_exists, mock_audit, admin_client, mock_db,
    ):
        """Admin can delete an existing logo."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert settings.logo_filename is None
        mock_remove.assert_called_once()

    async def test_delete_logo_when_none_exists(self, admin_client, mock_db):
        """Deleting when no logo is configured returns 404."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 404
        assert "No logo" in resp.json()["detail"]

    async def test_delete_logo_settings_exist_but_no_filename(self, admin_client, mock_db):
        """Settings row exists but logo_filename is None returns 404."""
        settings = _fake_settings(logo_filename=None)
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 404

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.path.exists", return_value=False)
    async def test_delete_logo_file_already_gone_from_disk(
        self, mock_exists, mock_audit, admin_client, mock_db,
    ):
        """Delete succeeds even if the file is already missing from disk."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 200
        assert settings.logo_filename is None

    async def test_delete_logo_as_operator_returns_403(self, operator_client):
        """Non-admin users cannot delete logos (403)."""
        resp = await operator_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 403

    async def test_delete_logo_as_viewer_returns_403(self, viewer_client):
        """Viewers cannot delete logos (403)."""
        resp = await viewer_client.delete("/api/v1/admin/company-logo")
        assert resp.status_code == 403


# ===========================================================================
# Get Logo (GET /api/v1/company/logo)
# ===========================================================================


class TestGetCompanyLogo:
    @patch("os.path.exists", return_value=True)
    @patch("os.path.splitext", return_value=("factory_1_abc123", ".png"))
    async def test_get_logo_success(self, mock_splitext, mock_exists, admin_client, mock_db):
        """Any authenticated user can retrieve the company logo."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        with patch("app.api.routes.company_settings.FileResponse") as mock_fr:
            mock_response = MagicMock()
            mock_response.headers = {}
            mock_fr.return_value = mock_response
            resp = await admin_client.get("/api/v1/company/logo")
            # FileResponse was constructed
            mock_fr.assert_called_once()

    @patch("os.path.exists", return_value=True)
    @patch("os.path.splitext", return_value=("factory_1_abc123", ".png"))
    async def test_get_logo_as_operator(self, mock_splitext, mock_exists, operator_client, mock_db):
        """Operators can view the logo."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        with patch("app.api.routes.company_settings.FileResponse") as mock_fr:
            mock_response = MagicMock()
            mock_response.headers = {}
            mock_fr.return_value = mock_response
            resp = await operator_client.get("/api/v1/company/logo")
            mock_fr.assert_called_once()

    @patch("os.path.exists", return_value=True)
    @patch("os.path.splitext", return_value=("factory_1_abc123", ".png"))
    async def test_get_logo_as_viewer(self, mock_splitext, mock_exists, viewer_client, mock_db):
        """Viewers can view the logo."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        with patch("app.api.routes.company_settings.FileResponse") as mock_fr:
            mock_response = MagicMock()
            mock_response.headers = {}
            mock_fr.return_value = mock_response
            resp = await viewer_client.get("/api/v1/company/logo")
            mock_fr.assert_called_once()

    async def test_get_logo_when_none_configured(self, admin_client, mock_db):
        """Getting logo when none exists returns 404."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/company/logo")
        assert resp.status_code == 404
        assert "No logo" in resp.json()["detail"]

    async def test_get_logo_settings_exist_but_no_filename(self, admin_client, mock_db):
        """Settings exist but logo_filename is None returns 404."""
        settings = _fake_settings(logo_filename=None)
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/company/logo")
        assert resp.status_code == 404

    @patch("os.path.exists", return_value=False)
    async def test_get_logo_file_missing_from_disk(self, mock_exists, admin_client, mock_db):
        """DB has logo reference but file is missing on disk returns 404."""
        settings = _fake_settings()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = settings
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/company/logo")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ===========================================================================
# Tenant Isolation
# ===========================================================================


class TestCompanyLogoTenantIsolation:
    """Verify that logo operations are scoped to the user's factory."""

    async def test_other_factory_sees_own_logo_or_404(self, other_factory_client, mock_db):
        """other_factory_client (factory_id=2) queries for factory 2's logo."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await other_factory_client.get("/api/v1/company/logo")
        assert resp.status_code == 404

    @patch("app.api.routes.company_settings.log_audit", new_callable=AsyncMock)
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    async def test_other_factory_uploads_to_own_factory(
        self, mock_open, mock_makedirs, mock_audit, other_factory_client, mock_db,
    ):
        """other_factory_client uploads logo scoped to factory_id=2."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("logo.png", BytesIO(png_bytes), "image/png")}
        resp = await other_factory_client.post("/api/v1/admin/company-logo", files=files)
        assert resp.status_code == 200
        # The filename should contain factory_2
        assert "factory_2_" in resp.json()["filename"]
