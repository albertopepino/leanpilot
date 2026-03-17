"""
Tests for lean-advanced tool endpoints: /api/v1/lean-advanced/*

Integration tests use httpx.AsyncClient with dependency overrides.
All service calls are mocked so no real DB is needed.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from tests.conftest import ADMIN_USER, OPERATOR_USER, VIEWER_USER


pytestmark = [pytest.mark.lean_advanced, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _mock_obj(id=1, **overrides):
    """Return a MagicMock that looks like a lean-advanced model instance."""
    obj = MagicMock()
    obj.id = id
    obj.status = MagicMock(value="open")
    obj.overall_score = overrides.get("overall_score", 3.5)
    obj.maturity_level = overrides.get("maturity_level", 3)
    obj.area_name = overrides.get("area_name", "Assembly")
    obj.audit_date = overrides.get("audit_date", datetime.now(timezone.utc))
    obj.notes = overrides.get("notes", None)
    obj.items = overrides.get("items", [])
    obj.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    obj.title = overrides.get("title", "Test")
    obj.product_family = overrides.get("product_family", "Widget A")
    obj.map_type = overrides.get("map_type", "current")
    obj.takt_time_sec = overrides.get("takt_time_sec", None)
    obj.total_lead_time_days = overrides.get("total_lead_time_days", 5.0)
    obj.total_processing_time_min = overrides.get("total_processing_time_min", 120.0)
    obj.pce_ratio = overrides.get("pce_ratio", 0.15)
    obj.steps = overrides.get("steps", [])
    obj.background = overrides.get("background", None)
    obj.current_condition = overrides.get("current_condition", None)
    obj.goal_statement = overrides.get("goal_statement", None)
    obj.root_cause_analysis = overrides.get("root_cause_analysis", None)
    obj.countermeasures = overrides.get("countermeasures", None)
    obj.implementation_plan = overrides.get("implementation_plan", None)
    obj.follow_up = overrides.get("follow_up", None)
    obj.results = overrides.get("results", None)
    obj.target_date = overrides.get("target_date", None)
    obj.area = overrides.get("area", "Shop floor")
    obj.walk_date = overrides.get("walk_date", datetime.now(timezone.utc))
    obj.duration_min = overrides.get("duration_min", None)
    obj.theme = overrides.get("theme", None)
    obj.summary = overrides.get("summary", None)
    obj.observations = overrides.get("observations", [])
    obj.name = overrides.get("name", "Test Equipment")
    obj.all_ok = overrides.get("all_ok", True)
    obj.resolution_time_min = overrides.get("resolution_time_min", 15)
    obj.is_win = overrides.get("is_win", True)
    for k, v in overrides.items():
        setattr(obj, k, v)
    return obj


# ===========================================================================
# 6S AUDIT
# ===========================================================================
class TestSixSCreate:
    @patch("app.api.routes.lean_advanced.SixSService.create_audit", new_callable=AsyncMock)
    async def test_create_six_s_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/six-s returns id, score, maturity."""
        mock_create.return_value = _mock_obj(id=1, overall_score=4.2, maturity_level=4)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/six-s",
            json={
                "area_name": "Assembly Line 1",
                "items": [
                    {"category": "sort", "question": "Are unnecessary items removed?", "score": 4}
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 1
        assert body["overall_score"] == 4.2
        assert body["maturity_level"] == 4

    async def test_create_six_s_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/six-s",
            json={"area_name": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_six_s_missing_area_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/six-s", json={})
        assert resp.status_code == 422


class TestSixSList:
    @patch("app.api.routes.lean_advanced.SixSService.list_audits", new_callable=AsyncMock)
    async def test_list_six_s_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/six-s")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_six_s_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/six-s")
        assert resp.status_code == 401


class TestSixSTrend:
    @patch("app.api.routes.lean_advanced.SixSService.get_trend", new_callable=AsyncMock)
    async def test_six_s_trend_success(self, mock_trend, admin_client):
        """GET /api/v1/lean-advanced/six-s/trend returns trend data."""
        mock_trend.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/six-s/trend")
        assert resp.status_code == 200

    @patch("app.api.routes.lean_advanced.SixSService.get_trend", new_callable=AsyncMock)
    async def test_six_s_trend_with_area_filter(self, mock_trend, admin_client):
        mock_trend.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/six-s/trend", params={"area": "Assembly"})
        assert resp.status_code == 200

    async def test_six_s_trend_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/six-s/trend")
        assert resp.status_code == 401


# ===========================================================================
# VSM
# ===========================================================================
class TestVSMCreate:
    @patch("app.api.routes.lean_advanced.VSMService.create", new_callable=AsyncMock)
    async def test_create_vsm_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/vsm returns id, pce_ratio, lead_time."""
        mock_create.return_value = _mock_obj(id=3, pce_ratio=0.12, total_lead_time_days=8.0)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/vsm",
            json={
                "title": "Widget A Current State",
                "product_family": "Widget A",
                "map_type": "current",
                "steps": [
                    {"step_order": 1, "process_name": "Stamping", "cycle_time_sec": 30.0}
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 3
        assert body["pce_ratio"] == 0.12

    async def test_create_vsm_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/vsm",
            json={"title": "Test", "product_family": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_vsm_missing_title_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean-advanced/vsm",
            json={"product_family": "Test"},
        )
        assert resp.status_code == 422


class TestVSMList:
    @patch("app.api.routes.lean_advanced.VSMService.list_maps", new_callable=AsyncMock)
    async def test_list_vsm_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/vsm")
        assert resp.status_code == 200

    async def test_list_vsm_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/vsm")
        assert resp.status_code == 401


# ===========================================================================
# A3 REPORT
# ===========================================================================
class TestA3Create:
    @patch("app.api.routes.lean_advanced.A3Service.create", new_callable=AsyncMock)
    async def test_create_a3_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/a3 returns id and status."""
        mock_create.return_value = _mock_obj(id=5)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/a3",
            json={
                "title": "Reduce scrap rate on Line 2",
                "background": "Scrap rate has been above 3% for 3 months",
                "goal_statement": "Reduce scrap to <1%",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 5
        assert body["status"] == "open"

    async def test_create_a3_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/a3",
            json={"title": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_a3_missing_title_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/a3", json={})
        assert resp.status_code == 422


class TestA3List:
    @patch("app.api.routes.lean_advanced.A3Service.list_reports", new_callable=AsyncMock)
    async def test_list_a3_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/a3")
        assert resp.status_code == 200

    async def test_list_a3_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/a3")
        assert resp.status_code == 401


class TestA3UpdateStatus:
    @patch("app.api.routes.lean_advanced.A3Service.update_status", new_callable=AsyncMock)
    async def test_update_a3_status_success(self, mock_update, admin_client):
        """PATCH /api/v1/lean-advanced/a3/{id}/status updates status."""
        updated = _mock_obj(id=5, title="Reduce scrap rate")
        updated.status = "completed"
        mock_update.return_value = updated

        resp = await admin_client.patch(
            "/api/v1/lean-advanced/a3/5/status",
            params={"status": "completed", "results": "Scrap reduced to 0.8%"},
        )

        assert resp.status_code == 200

    async def test_update_a3_status_anon_returns_401(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/lean-advanced/a3/1/status",
            params={"status": "completed"},
        )
        assert resp.status_code == 401


# ===========================================================================
# GEMBA WALK
# ===========================================================================
class TestGembaCreate:
    @patch("app.api.routes.lean_advanced.GembaService.create_walk", new_callable=AsyncMock)
    async def test_create_gemba_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/gemba returns id."""
        mock_create.return_value = _mock_obj(id=8)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/gemba",
            json={
                "area": "Production Hall A",
                "duration_min": 30,
                "theme": "Safety",
                "observations": [
                    {
                        "observation_type": "concern",
                        "description": "Oil spill near press #4",
                        "action_required": True,
                    }
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["id"] == 8

    async def test_create_gemba_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/gemba",
            json={"area": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_gemba_missing_area_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/gemba", json={})
        assert resp.status_code == 422


class TestGembaList:
    @patch("app.api.routes.lean_advanced.GembaService.list_walks", new_callable=AsyncMock)
    async def test_list_gemba_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/gemba")
        assert resp.status_code == 200

    async def test_list_gemba_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/gemba")
        assert resp.status_code == 401


# ===========================================================================
# TPM
# ===========================================================================
class TestTPMEquipmentCreate:
    @patch("app.api.routes.lean_advanced.TPMService.create_equipment", new_callable=AsyncMock)
    async def test_create_tpm_equipment_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/tpm/equipment returns id and name."""
        mock_create.return_value = _mock_obj(id=10, name="CNC Lathe #3")

        resp = await admin_client.post(
            "/api/v1/lean-advanced/tpm/equipment",
            json={
                "name": "CNC Lathe #3",
                "equipment_code": "CNC-003",
                "location": "Hall B",
                "criticality": "high",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 10
        assert body["name"] == "CNC Lathe #3"

    async def test_create_tpm_equipment_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/tpm/equipment",
            json={"name": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_tpm_equipment_missing_name_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/tpm/equipment", json={})
        assert resp.status_code == 422


class TestTPMEquipmentList:
    @patch("app.api.routes.lean_advanced.TPMService.list_equipment", new_callable=AsyncMock)
    async def test_list_tpm_equipment_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/tpm/equipment")
        assert resp.status_code == 200

    async def test_list_tpm_equipment_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/tpm/equipment")
        assert resp.status_code == 401


class TestTPMMaintenanceLog:
    @patch("app.api.routes.lean_advanced.TPMService.log_maintenance", new_callable=AsyncMock)
    async def test_log_tpm_maintenance_success(self, mock_log, admin_client):
        """POST /api/v1/lean-advanced/tpm/maintenance returns id."""
        mock_log.return_value = _mock_obj(id=20)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/tpm/maintenance",
            json={
                "equipment_id": 10,
                "maintenance_type": "preventive",
                "description": "Replaced bearings and lubricated spindle",
                "duration_min": 45,
            },
        )

        assert resp.status_code == 200
        assert resp.json()["id"] == 20

    async def test_log_tpm_maintenance_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/tpm/maintenance",
            json={"equipment_id": 1, "maintenance_type": "corrective", "description": "Fix"},
        )
        assert resp.status_code == 401

    async def test_log_tpm_maintenance_missing_fields_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/tpm/maintenance", json={})
        assert resp.status_code == 422


# ===========================================================================
# CILT
# ===========================================================================
class TestCILTStandardCreate:
    @patch("app.api.routes.lean_advanced.CILTService.create_standard", new_callable=AsyncMock)
    async def test_create_cilt_standard_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/cilt/standards returns id and name."""
        mock_create.return_value = _mock_obj(id=30, name="Press #2 Daily CILT")

        resp = await admin_client.post(
            "/api/v1/lean-advanced/cilt/standards",
            json={
                "name": "Press #2 Daily CILT",
                "frequency": "daily",
                "items": [
                    {
                        "item_order": 1,
                        "category": "cleaning",
                        "description": "Clean die surface",
                    }
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 30
        assert body["name"] == "Press #2 Daily CILT"

    async def test_create_cilt_standard_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/cilt/standards",
            json={"name": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_cilt_standard_missing_name_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/cilt/standards", json={})
        assert resp.status_code == 422


class TestCILTStandardList:
    @patch("app.api.routes.lean_advanced.CILTService.list_standards", new_callable=AsyncMock)
    async def test_list_cilt_standards_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean-advanced/cilt/standards")
        assert resp.status_code == 200

    async def test_list_cilt_standards_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/cilt/standards")
        assert resp.status_code == 401


class TestCILTExecute:
    @patch("app.api.routes.lean_advanced.CILTService.execute_cilt", new_callable=AsyncMock)
    async def test_execute_cilt_success(self, mock_execute, admin_client):
        """POST /api/v1/lean-advanced/cilt/execute returns id and all_ok."""
        mock_execute.return_value = _mock_obj(id=31, all_ok=True)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/cilt/execute",
            json={
                "standard_id": 30,
                "shift": "morning",
                "checks": [
                    {"item_id": 1, "status": "ok"}
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 31
        assert body["all_ok"] is True

    @patch("app.api.routes.lean_advanced.CILTService.execute_cilt", new_callable=AsyncMock)
    async def test_execute_cilt_with_anomaly(self, mock_execute, admin_client):
        """CILT execution with NOK check returns all_ok=False."""
        mock_execute.return_value = _mock_obj(id=32, all_ok=False)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/cilt/execute",
            json={
                "standard_id": 30,
                "checks": [
                    {"item_id": 1, "status": "nok", "anomaly_description": "Crack detected"}
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["all_ok"] is False

    async def test_execute_cilt_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/cilt/execute",
            json={"standard_id": 1},
        )
        assert resp.status_code == 401

    async def test_execute_cilt_missing_standard_id_returns_422(self, admin_client):
        resp = await admin_client.post("/api/v1/lean-advanced/cilt/execute", json={})
        assert resp.status_code == 422


class TestCILTCompliance:
    @patch("app.api.routes.lean_advanced.CILTService.get_compliance_rate", new_callable=AsyncMock)
    async def test_cilt_compliance_success(self, mock_compliance, admin_client):
        """GET /api/v1/lean-advanced/cilt/compliance returns compliance data."""
        mock_compliance.return_value = {"compliance_rate": 0.92, "total_executions": 50}
        resp = await admin_client.get("/api/v1/lean-advanced/cilt/compliance")
        assert resp.status_code == 200
        assert resp.json()["compliance_rate"] == 0.92

    async def test_cilt_compliance_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/cilt/compliance")
        assert resp.status_code == 401


# ===========================================================================
# ANDON
# ===========================================================================
class TestAndonCreate:
    @patch("app.api.routes.lean_advanced.AndonService.create_event", new_callable=AsyncMock)
    async def test_create_andon_success(self, mock_create, admin_client):
        """POST /api/v1/lean-advanced/andon returns id and status."""
        mock_create.return_value = _mock_obj(id=40)
        mock_create.return_value.status = MagicMock(value="red")

        resp = await admin_client.post(
            "/api/v1/lean-advanced/andon",
            json={
                "production_line_id": 1,
                "status": "red",
                "reason": "Machine breakdown",
                "description": "Hydraulic pump failure on press #4",
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 40
        assert body["status"] == "red"

    async def test_create_andon_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/andon",
            json={"production_line_id": 1, "status": "red"},
        )
        assert resp.status_code == 401

    async def test_create_andon_missing_line_id_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean-advanced/andon",
            json={"status": "red"},
        )
        assert resp.status_code == 422

    async def test_create_andon_missing_status_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean-advanced/andon",
            json={"production_line_id": 1},
        )
        assert resp.status_code == 422


class TestAndonResolve:
    @patch("app.api.routes.lean_advanced.AndonService.resolve_event", new_callable=AsyncMock)
    async def test_resolve_andon_success(self, mock_resolve, admin_client):
        """POST /api/v1/lean-advanced/andon/{id}/resolve returns id and resolution_time."""
        mock_resolve.return_value = _mock_obj(id=40, resolution_time_min=22)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/andon/40/resolve",
            json={"resolution_notes": "Replaced hydraulic pump"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 40
        assert body["resolution_time_min"] == 22

    @patch("app.api.routes.lean_advanced.AndonService.resolve_event", new_callable=AsyncMock)
    async def test_resolve_andon_without_notes(self, mock_resolve, admin_client):
        """Resolving without notes should also work."""
        mock_resolve.return_value = _mock_obj(id=40, resolution_time_min=10)

        resp = await admin_client.post("/api/v1/lean-advanced/andon/40/resolve")
        assert resp.status_code == 200

    async def test_resolve_andon_anon_returns_401(self, anon_client):
        resp = await anon_client.post("/api/v1/lean-advanced/andon/1/resolve")
        assert resp.status_code == 401


class TestAndonStatus:
    @patch("app.api.routes.lean_advanced.AndonService.get_current_status", new_callable=AsyncMock)
    async def test_andon_current_status_success(self, mock_status, admin_client):
        """GET /api/v1/lean-advanced/andon/status returns current status."""
        mock_status.return_value = {"active_events": [], "lines_status": {}}
        resp = await admin_client.get("/api/v1/lean-advanced/andon/status")
        assert resp.status_code == 200

    async def test_andon_current_status_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean-advanced/andon/status")
        assert resp.status_code == 401


# ===========================================================================
# HOURLY PRODUCTION
# ===========================================================================
class TestHourlyProductionLog:
    @patch("app.api.routes.lean_advanced.HourlyProductionService.log_hour", new_callable=AsyncMock)
    async def test_log_hourly_production_success(self, mock_log, admin_client):
        """POST /api/v1/lean-advanced/hourly returns id and is_win."""
        mock_log.return_value = _mock_obj(id=50, is_win=True)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/hourly",
            json={
                "production_line_id": 1,
                "date": "2026-03-15T08:00:00",
                "hour": 8,
                "shift": "morning",
                "target_pieces": 100,
                "actual_pieces": 105,
                "scrap_pieces": 2,
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 50
        assert body["is_win"] is True

    @patch("app.api.routes.lean_advanced.HourlyProductionService.log_hour", new_callable=AsyncMock)
    async def test_log_hourly_production_loss(self, mock_log, admin_client):
        """Logging below target returns is_win=False."""
        mock_log.return_value = _mock_obj(id=51, is_win=False)

        resp = await admin_client.post(
            "/api/v1/lean-advanced/hourly",
            json={
                "production_line_id": 1,
                "date": "2026-03-15T09:00:00",
                "hour": 9,
                "target_pieces": 100,
                "actual_pieces": 80,
            },
        )

        assert resp.status_code == 200
        assert resp.json()["is_win"] is False

    async def test_log_hourly_production_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean-advanced/hourly",
            json={
                "production_line_id": 1,
                "date": "2026-03-15T08:00:00",
                "hour": 8,
                "target_pieces": 100,
                "actual_pieces": 90,
            },
        )
        assert resp.status_code == 401

    async def test_log_hourly_missing_target_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean-advanced/hourly",
            json={
                "production_line_id": 1,
                "date": "2026-03-15T08:00:00",
                "hour": 8,
                "actual_pieces": 90,
            },
        )
        assert resp.status_code == 422


class TestHourlyProductionView:
    @patch("app.api.routes.lean_advanced.HourlyProductionService.get_day_view", new_callable=AsyncMock)
    async def test_get_hourly_view_success(self, mock_view, admin_client):
        """GET /api/v1/lean-advanced/hourly/{line_id} returns day view."""
        mock_view.return_value = {"hours": [], "summary": {}}

        resp = await admin_client.get(
            "/api/v1/lean-advanced/hourly/1",
            params={"date": "2026-03-15"},
        )

        assert resp.status_code == 200

    async def test_get_hourly_view_missing_date_returns_422(self, admin_client):
        """date query param is required."""
        resp = await admin_client.get("/api/v1/lean-advanced/hourly/1")
        assert resp.status_code == 422

    async def test_get_hourly_view_anon_returns_401(self, anon_client):
        resp = await anon_client.get(
            "/api/v1/lean-advanced/hourly/1",
            params={"date": "2026-03-15"},
        )
        assert resp.status_code == 401


# ===========================================================================
# ROLE-BASED ACCESS — operators can use lean-advanced tools
# ===========================================================================
class TestOperatorAccess:
    @patch("app.api.routes.lean_advanced.SixSService.list_audits", new_callable=AsyncMock)
    async def test_operator_can_list_six_s(self, mock_list, operator_client):
        mock_list.return_value = []
        resp = await operator_client.get("/api/v1/lean-advanced/six-s")
        assert resp.status_code == 200

    @patch("app.api.routes.lean_advanced.AndonService.create_event", new_callable=AsyncMock)
    async def test_operator_can_create_andon(self, mock_create, operator_client):
        mock_create.return_value = _mock_obj(id=99)
        mock_create.return_value.status = MagicMock(value="yellow")

        resp = await operator_client.post(
            "/api/v1/lean-advanced/andon",
            json={"production_line_id": 1, "status": "yellow", "reason": "Material shortage"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.lean_advanced.HourlyProductionService.log_hour", new_callable=AsyncMock)
    async def test_operator_can_log_hourly(self, mock_log, operator_client):
        mock_log.return_value = _mock_obj(id=100, is_win=True)

        resp = await operator_client.post(
            "/api/v1/lean-advanced/hourly",
            json={
                "production_line_id": 1,
                "date": "2026-03-15T10:00:00",
                "hour": 10,
                "target_pieces": 50,
                "actual_pieces": 55,
            },
        )
        assert resp.status_code == 200


class TestViewerAccess:
    @patch("app.api.routes.lean_advanced.SixSService.list_audits", new_callable=AsyncMock)
    async def test_viewer_can_list_six_s(self, mock_list, viewer_client):
        mock_list.return_value = []
        resp = await viewer_client.get("/api/v1/lean-advanced/six-s")
        assert resp.status_code == 200

    @patch("app.api.routes.lean_advanced.AndonService.get_current_status", new_callable=AsyncMock)
    async def test_viewer_can_view_andon_status(self, mock_status, viewer_client):
        mock_status.return_value = {}
        resp = await viewer_client.get("/api/v1/lean-advanced/andon/status")
        assert resp.status_code == 200

    @patch("app.api.routes.lean_advanced.CILTService.get_compliance_rate", new_callable=AsyncMock)
    async def test_viewer_can_view_cilt_compliance(self, mock_compliance, viewer_client):
        mock_compliance.return_value = {"compliance_rate": 0.95}
        resp = await viewer_client.get("/api/v1/lean-advanced/cilt/compliance")
        assert resp.status_code == 200
