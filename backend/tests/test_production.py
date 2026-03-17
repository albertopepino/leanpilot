"""
Tests for production endpoints: /api/v1/production/*

Covers ProductionRecords, DowntimeEvents, and ScrapRecords.
Integration tests use httpx.AsyncClient with dependency overrides.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from tests.conftest import ADMIN_USER, OPERATOR_USER, VIEWER_USER


pytestmark = [pytest.mark.production, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers — mock objects
# ---------------------------------------------------------------------------

def _fake_production_line(**overrides):
    defaults = dict(
        id=1,
        factory_id=1,
        name="Assembly Line 1",
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_production_record(**overrides):
    defaults = dict(
        id=1,
        production_line_id=1,
        shift_id=None,
        recorded_by_id=1,
        date=datetime(2025, 6, 1, tzinfo=timezone.utc),
        planned_production_time_min=480.0,
        actual_run_time_min=420.0,
        total_pieces=1000,
        good_pieces=950,
        ideal_cycle_time_sec=30.0,
        notes=None,
        created_at=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_downtime_event(**overrides):
    defaults = dict(
        id=1,
        production_line_id=1,
        production_record_id=None,
        recorded_by_id=1,
        start_time=datetime(2025, 6, 1, 8, 0, tzinfo=timezone.utc),
        end_time=datetime(2025, 6, 1, 8, 30, tzinfo=timezone.utc),
        duration_minutes=30.0,
        category="mechanical",
        reason="Belt replacement",
        machine="Conveyor A",
        notes=None,
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_scrap_record(**overrides):
    defaults = dict(
        id=1,
        production_line_id=1,
        production_record_id=None,
        recorded_by_id=1,
        date=datetime(2025, 6, 1, tzinfo=timezone.utc),
        quantity=10,
        defect_type="scratch",
        defect_description="Surface scratch on panel",
        cost_estimate=50.0,
        root_cause="Tool wear",
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _mock_verify_line_ok(mock_db):
    """Configure mock_db so _verify_line_belongs_to_factory passes."""
    line = _fake_production_line()
    result = MagicMock()
    result.scalar_one_or_none.return_value = line
    mock_db.execute = AsyncMock(return_value=result)
    return line


def _mock_verify_line_fail(mock_db):
    """Configure mock_db so _verify_line_belongs_to_factory raises 403."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=result)


# ═══════════════════════════════════════════════════════════════════════════
# Create Production Record
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateProductionRecord:
    """POST /api/v1/production/records"""

    VALID_PAYLOAD = {
        "production_line_id": 1,
        "date": "2025-06-01T00:00:00",
        "planned_production_time_min": 480.0,
        "actual_run_time_min": 420.0,
        "total_pieces": 1000,
        "good_pieces": 950,
        "ideal_cycle_time_sec": 30.0,
    }

    @patch("app.api.routes.production.OEECalculator.calculate_and_store", new_callable=AsyncMock)
    async def test_create_record_success(self, mock_oee, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        resp = await admin_client.post(
            "/api/v1/production/records",
            json=self.VALID_PAYLOAD,
        )
        assert resp.status_code == 200
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited_once()
        mock_oee.assert_awaited_once()

    @patch("app.api.routes.production.OEECalculator.calculate_and_store", new_callable=AsyncMock)
    async def test_create_record_with_shift_and_notes(self, mock_oee, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        payload = {**self.VALID_PAYLOAD, "shift_id": 1, "notes": "Morning shift"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 200

    @patch("app.api.routes.production.OEECalculator.calculate_and_store", new_callable=AsyncMock)
    async def test_create_record_date_string_without_time(self, mock_oee, admin_client, mock_db):
        """The field_validator should parse '2025-06-01' into a datetime."""
        _mock_verify_line_ok(mock_db)

        payload = {**self.VALID_PAYLOAD, "date": "2025-06-01"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 200

    async def test_create_record_missing_line_id_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "production_line_id"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_date_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "date"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_total_pieces_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "total_pieces"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_good_pieces_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "good_pieces"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_cycle_time_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "ideal_cycle_time_sec"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_planned_time_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "planned_production_time_min"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_missing_actual_run_time_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "actual_run_time_min"}
        resp = await admin_client.post("/api/v1/production/records", json=payload)
        assert resp.status_code == 422

    async def test_create_record_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/production/records", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401

    async def test_create_record_wrong_factory_returns_403(self, admin_client, mock_db):
        """If the production line does not belong to the user's factory, expect 403."""
        _mock_verify_line_fail(mock_db)
        resp = await admin_client.post("/api/v1/production/records", json=self.VALID_PAYLOAD)
        assert resp.status_code == 403

    @patch("app.api.routes.production.OEECalculator.calculate_and_store", new_callable=AsyncMock)
    async def test_create_record_operator_can_access(self, mock_oee, operator_client, mock_db):
        _mock_verify_line_ok(mock_db)
        resp = await operator_client.post("/api/v1/production/records", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# List Production Records
# ═══════════════════════════════════════════════════════════════════════════


class TestListProductionRecords:
    """GET /api/v1/production/records"""

    async def test_list_records_success(self, admin_client, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/production/records")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_records_returns_items(self, admin_client, mock_db):
        record = _fake_production_record()
        result = MagicMock()
        result.scalars.return_value.all.return_value = [record]
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/production/records")
        assert resp.status_code == 200

    async def test_list_records_filter_by_line(self, admin_client, mock_db):
        # First call: _verify_line_belongs_to_factory; second call: the actual query
        line = _fake_production_line()
        verify_result = MagicMock()
        verify_result.scalar_one_or_none.return_value = line
        query_result = MagicMock()
        query_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(side_effect=[verify_result, query_result])

        resp = await admin_client.get("/api/v1/production/records?line_id=1")
        assert resp.status_code == 200

    async def test_list_records_filter_by_line_wrong_factory_returns_403(self, admin_client, mock_db):
        verify_result = MagicMock()
        verify_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=verify_result)

        resp = await admin_client.get("/api/v1/production/records?line_id=999")
        assert resp.status_code == 403

    async def test_list_records_with_limit(self, admin_client, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/production/records?limit=10")
        assert resp.status_code == 200

    async def test_list_records_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/production/records")
        assert resp.status_code == 401

    async def test_list_records_viewer_can_access(self, viewer_client, mock_db):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await viewer_client.get("/api/v1/production/records")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# Create Downtime Event
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateDowntimeEvent:
    """POST /api/v1/production/downtime"""

    VALID_PAYLOAD = {
        "production_line_id": 1,
        "start_time": "2025-06-01T08:00:00",
        "end_time": "2025-06-01T08:30:00",
        "duration_minutes": 30.0,
        "category": "mechanical",
        "reason": "Belt replacement",
    }

    async def test_create_downtime_success(self, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        resp = await admin_client.post("/api/v1/production/downtime", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "created"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited_once()

    async def test_create_downtime_all_fields(self, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        payload = {
            **self.VALID_PAYLOAD,
            "production_record_id": 1,
            "machine": "Conveyor A",
            "notes": "Scheduled maintenance",
        }
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 200

    async def test_create_downtime_date_string_without_time(self, admin_client, mock_db):
        """The field_validator should parse date-only strings."""
        _mock_verify_line_ok(mock_db)

        payload = {**self.VALID_PAYLOAD, "start_time": "2025-06-01", "end_time": "2025-06-01"}
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 200

    async def test_create_downtime_missing_line_id_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "production_line_id"}
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 422

    async def test_create_downtime_missing_category_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "category"}
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 422

    async def test_create_downtime_missing_reason_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "reason"}
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 422

    async def test_create_downtime_missing_start_time_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "start_time"}
        resp = await admin_client.post("/api/v1/production/downtime", json=payload)
        assert resp.status_code == 422

    async def test_create_downtime_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/production/downtime", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401

    async def test_create_downtime_wrong_factory_returns_403(self, admin_client, mock_db):
        _mock_verify_line_fail(mock_db)
        resp = await admin_client.post("/api/v1/production/downtime", json=self.VALID_PAYLOAD)
        assert resp.status_code == 403

    async def test_create_downtime_operator_can_access(self, operator_client, mock_db):
        _mock_verify_line_ok(mock_db)
        resp = await operator_client.post("/api/v1/production/downtime", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# Create Scrap Record
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateScrapRecord:
    """POST /api/v1/production/scrap"""

    VALID_PAYLOAD = {
        "production_line_id": 1,
        "date": "2025-06-01T00:00:00",
        "quantity": 10,
        "defect_type": "scratch",
    }

    async def test_create_scrap_success(self, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        resp = await admin_client.post("/api/v1/production/scrap", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "created"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited_once()

    async def test_create_scrap_all_fields(self, admin_client, mock_db):
        _mock_verify_line_ok(mock_db)

        payload = {
            **self.VALID_PAYLOAD,
            "production_record_id": 1,
            "defect_description": "Surface scratch on panel",
            "cost_estimate": 50.0,
            "root_cause": "Tool wear",
        }
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 200

    async def test_create_scrap_date_string_without_time(self, admin_client, mock_db):
        """The field_validator should parse '2025-06-01' into a datetime."""
        _mock_verify_line_ok(mock_db)

        payload = {**self.VALID_PAYLOAD, "date": "2025-06-01"}
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 200

    async def test_create_scrap_missing_line_id_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "production_line_id"}
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 422

    async def test_create_scrap_missing_date_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "date"}
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 422

    async def test_create_scrap_missing_quantity_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "quantity"}
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 422

    async def test_create_scrap_missing_defect_type_returns_422(self, admin_client):
        payload = {k: v for k, v in self.VALID_PAYLOAD.items() if k != "defect_type"}
        resp = await admin_client.post("/api/v1/production/scrap", json=payload)
        assert resp.status_code == 422

    async def test_create_scrap_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/production/scrap", json=self.VALID_PAYLOAD)
        assert resp.status_code == 401

    async def test_create_scrap_wrong_factory_returns_403(self, admin_client, mock_db):
        _mock_verify_line_fail(mock_db)
        resp = await admin_client.post("/api/v1/production/scrap", json=self.VALID_PAYLOAD)
        assert resp.status_code == 403

    async def test_create_scrap_operator_can_access(self, operator_client, mock_db):
        _mock_verify_line_ok(mock_db)
        resp = await operator_client.post("/api/v1/production/scrap", json=self.VALID_PAYLOAD)
        assert resp.status_code == 200
