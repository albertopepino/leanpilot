"""
Tests for lean tool endpoints: /api/v1/lean/*

Integration tests use httpx.AsyncClient with dependency overrides.
All service calls are mocked so no real DB is needed.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from tests.conftest import ADMIN_USER, OPERATOR_USER, VIEWER_USER


pytestmark = [pytest.mark.lean, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _mock_analysis(id=1, **overrides):
    """Return a MagicMock that looks like a lean analysis model instance."""
    obj = MagicMock()
    obj.id = id
    obj.status = MagicMock(value="open")
    obj.title = overrides.get("title", "Test Analysis")
    obj.problem_statement = overrides.get("problem_statement", "Test problem")
    obj.root_cause = overrides.get("root_cause", None)
    obj.countermeasure = overrides.get("countermeasure", None)
    obj.responsible = overrides.get("responsible", None)
    obj.due_date = overrides.get("due_date", None)
    obj.ai_generated = overrides.get("ai_generated", False)
    obj.steps = overrides.get("steps", [])
    obj.effect = overrides.get("effect", "Test effect")
    obj.conclusion = overrides.get("conclusion", None)
    obj.causes = overrides.get("causes", [])
    obj.description = overrides.get("description", "Test description")
    obj.category = overrides.get("category", None)
    obj.priority = overrides.get("priority", "medium")
    obj.expected_impact = overrides.get("expected_impact", None)
    obj.expected_savings_eur = overrides.get("expected_savings_eur", None)
    obj.actual_savings_eur = overrides.get("actual_savings_eur", None)
    obj.ai_confidence = overrides.get("ai_confidence", None)
    obj.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    obj.overall_score = overrides.get("overall_score", 0.0)
    obj.changeover_name = overrides.get("changeover_name", "Test changeover")
    obj.baseline_time_min = overrides.get("baseline_time_min", 60.0)
    obj.current_time_min = overrides.get("current_time_min", None)
    obj.target_time_min = overrides.get("target_time_min", None)
    obj.production_line_id = overrides.get("production_line_id", 1)
    for k, v in overrides.items():
        setattr(obj, k, v)
    return obj


def _mock_db_scalars_all(mock_db, items):
    """Configure mock_db.execute to return items via scalars().all()."""
    result = MagicMock()
    result.scalars.return_value.all.return_value = items
    mock_db.execute = AsyncMock(return_value=result)


def _mock_db_scalar_one_or_none(mock_db, item):
    """Configure mock_db.execute to return item via scalar_one_or_none()."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = item
    mock_db.execute = AsyncMock(return_value=result)


# ===========================================================================
# 5 WHY
# ===========================================================================
class TestFiveWhyCreate:
    @patch("app.api.routes.lean.FiveWhyService.create", new_callable=AsyncMock)
    async def test_create_five_why_success(self, mock_create, admin_client):
        """POST /api/v1/lean/five-why with valid data returns id and status."""
        mock_create.return_value = _mock_analysis(id=42)

        resp = await admin_client.post(
            "/api/v1/lean/five-why",
            json={
                "title": "Defective widgets",
                "problem_statement": "Widget failure rate above 5%",
                "steps": [
                    {"step_number": 1, "why_question": "Why?", "answer": "Because..."}
                ],
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 42
        assert body["status"] == "open"

    @patch("app.api.routes.lean.FiveWhyService.create", new_callable=AsyncMock)
    async def test_create_five_why_as_operator(self, mock_create, operator_client):
        """Operators should also be able to create 5-Why analyses."""
        mock_create.return_value = _mock_analysis(id=10)

        resp = await operator_client.post(
            "/api/v1/lean/five-why",
            json={"title": "Issue X", "problem_statement": "Problem X"},
        )
        assert resp.status_code == 200

    async def test_create_five_why_anon_returns_401(self, anon_client):
        """Anonymous users should get 401."""
        resp = await anon_client.post(
            "/api/v1/lean/five-why",
            json={"title": "Test", "problem_statement": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_five_why_missing_title_returns_422(self, admin_client):
        """Missing required field 'title' returns 422."""
        resp = await admin_client.post(
            "/api/v1/lean/five-why",
            json={"problem_statement": "No title provided"},
        )
        assert resp.status_code == 422

    async def test_create_five_why_missing_problem_returns_422(self, admin_client):
        """Missing required field 'problem_statement' returns 422."""
        resp = await admin_client.post(
            "/api/v1/lean/five-why",
            json={"title": "Some title"},
        )
        assert resp.status_code == 422


class TestFiveWhyList:
    @patch("app.api.routes.lean.FiveWhyService.list_by_factory", new_callable=AsyncMock)
    async def test_list_five_why_success(self, mock_list, admin_client):
        """GET /api/v1/lean/five-why returns list of analyses."""
        mock_list.return_value = []

        resp = await admin_client.get("/api/v1/lean/five-why")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_five_why_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/five-why")
        assert resp.status_code == 401


class TestFiveWhyGetById:
    @patch("app.api.routes.lean.FiveWhyService.get_by_id", new_callable=AsyncMock)
    async def test_get_five_why_success(self, mock_get, admin_client):
        """GET /api/v1/lean/five-why/{id} returns analysis."""
        analysis = _mock_analysis(id=1)
        analysis.status = "open"  # FiveWhyResponse expects str
        mock_get.return_value = analysis

        resp = await admin_client.get("/api/v1/lean/five-why/1")
        assert resp.status_code == 200

    @patch("app.api.routes.lean.FiveWhyService.get_by_id", new_callable=AsyncMock)
    async def test_get_five_why_not_found_returns_404(self, mock_get, admin_client):
        """GET /api/v1/lean/five-why/{id} with non-existent id returns 404."""
        mock_get.return_value = None

        resp = await admin_client.get("/api/v1/lean/five-why/999")
        assert resp.status_code == 404

    async def test_get_five_why_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/five-why/1")
        assert resp.status_code == 401


class TestFiveWhyDelete:
    @patch("app.api.routes.lean.FiveWhyService.delete", new_callable=AsyncMock)
    async def test_delete_five_why_success(self, mock_delete, admin_client):
        """DELETE /api/v1/lean/five-why/{id} returns deleted status."""
        mock_delete.return_value = None

        resp = await admin_client.delete("/api/v1/lean/five-why/1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    async def test_delete_five_why_anon_returns_401(self, anon_client):
        resp = await anon_client.delete("/api/v1/lean/five-why/1")
        assert resp.status_code == 401


# ===========================================================================
# ISHIKAWA
# ===========================================================================
class TestIshikawaCreate:
    @patch("app.api.routes.lean.IshikawaService.create", new_callable=AsyncMock)
    async def test_create_ishikawa_success(self, mock_create, admin_client):
        """POST /api/v1/lean/ishikawa with valid data returns id."""
        mock_create.return_value = _mock_analysis(id=5)

        resp = await admin_client.post(
            "/api/v1/lean/ishikawa",
            json={
                "title": "Quality Issue",
                "effect": "Defective product",
                "causes": [
                    {"category": "man", "cause": "Insufficient training"}
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["id"] == 5

    async def test_create_ishikawa_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean/ishikawa",
            json={"title": "Test", "effect": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_ishikawa_missing_effect_returns_422(self, admin_client):
        """Missing required field 'effect' returns 422."""
        resp = await admin_client.post(
            "/api/v1/lean/ishikawa",
            json={"title": "Some title"},
        )
        assert resp.status_code == 422


class TestIshikawaList:
    @patch("app.api.routes.lean.IshikawaService.list_by_factory", new_callable=AsyncMock)
    async def test_list_ishikawa_success(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/lean/ishikawa")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_ishikawa_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/ishikawa")
        assert resp.status_code == 401


class TestIshikawaGetById:
    @patch("app.api.routes.lean.IshikawaService.get_by_id", new_callable=AsyncMock)
    async def test_get_ishikawa_success(self, mock_get, admin_client):
        analysis = _mock_analysis(id=3)
        analysis.status = "open"
        mock_get.return_value = analysis
        resp = await admin_client.get("/api/v1/lean/ishikawa/3")
        assert resp.status_code == 200

    @patch("app.api.routes.lean.IshikawaService.get_by_id", new_callable=AsyncMock)
    async def test_get_ishikawa_not_found_returns_404(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/lean/ishikawa/999")
        assert resp.status_code == 404

    async def test_get_ishikawa_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/ishikawa/1")
        assert resp.status_code == 401


class TestIshikawaDelete:
    @patch("app.api.routes.lean.IshikawaService.delete", new_callable=AsyncMock)
    async def test_delete_ishikawa_success(self, mock_delete, admin_client):
        mock_delete.return_value = None
        resp = await admin_client.delete("/api/v1/lean/ishikawa/1")
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    async def test_delete_ishikawa_anon_returns_401(self, anon_client):
        resp = await anon_client.delete("/api/v1/lean/ishikawa/1")
        assert resp.status_code == 401


# ===========================================================================
# KAIZEN
# ===========================================================================
class TestKaizenCreate:
    @patch("app.api.routes.lean.KaizenService.create", new_callable=AsyncMock)
    async def test_create_kaizen_success(self, mock_create, admin_client):
        """POST /api/v1/lean/kaizen returns id and status."""
        mock_create.return_value = _mock_analysis(id=7)

        resp = await admin_client.post(
            "/api/v1/lean/kaizen",
            json={
                "title": "Reduce changeover time",
                "description": "Apply SMED to line 3",
                "priority": "high",
                "expected_savings_eur": 5000.0,
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 7
        assert body["status"] == "open"

    async def test_create_kaizen_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean/kaizen",
            json={"title": "Test", "description": "Test"},
        )
        assert resp.status_code == 401

    async def test_create_kaizen_missing_description_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean/kaizen",
            json={"title": "Title only"},
        )
        assert resp.status_code == 422


class TestKaizenBoard:
    @patch("app.api.routes.lean.KaizenService.get_board", new_callable=AsyncMock)
    async def test_get_kaizen_board_success(self, mock_board, admin_client):
        """GET /api/v1/lean/kaizen/board returns list."""
        mock_board.return_value = []
        resp = await admin_client.get("/api/v1/lean/kaizen/board")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_get_kaizen_board_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/kaizen/board")
        assert resp.status_code == 401


class TestKaizenUpdateStatus:
    @patch("app.api.routes.lean.KaizenService.update_status", new_callable=AsyncMock)
    async def test_update_kaizen_status_success(self, mock_update, admin_client):
        """PATCH /api/v1/lean/kaizen/{id}/status updates status."""
        updated = _mock_analysis(id=7, title="Reduce changeover time")
        updated.status = MagicMock(value="in_progress")
        mock_update.return_value = updated

        resp = await admin_client.patch(
            "/api/v1/lean/kaizen/7/status",
            params={"new_status": "in_progress"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 7
        assert body["status"] == "in_progress"

    @patch("app.api.routes.lean.KaizenService.update_status", new_callable=AsyncMock)
    async def test_update_kaizen_status_with_savings(self, mock_update, admin_client):
        """PATCH with actual_savings parameter."""
        updated = _mock_analysis(id=7, title="Improvement")
        updated.status = MagicMock(value="completed")
        mock_update.return_value = updated

        resp = await admin_client.patch(
            "/api/v1/lean/kaizen/7/status",
            params={"new_status": "completed", "actual_savings": 3500.0},
        )

        assert resp.status_code == 200

    async def test_update_kaizen_status_anon_returns_401(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/lean/kaizen/1/status",
            params={"new_status": "done"},
        )
        assert resp.status_code == 401


class TestKaizenSavings:
    @patch("app.api.routes.lean.KaizenService.get_savings_summary", new_callable=AsyncMock)
    async def test_get_kaizen_savings_success(self, mock_savings, admin_client):
        """GET /api/v1/lean/kaizen/savings returns summary."""
        mock_savings.return_value = {
            "total_expected": 10000.0,
            "total_actual": 7500.0,
            "count": 3,
        }
        resp = await admin_client.get("/api/v1/lean/kaizen/savings")
        assert resp.status_code == 200
        body = resp.json()
        assert "total_expected" in body

    async def test_get_kaizen_savings_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/kaizen/savings")
        assert resp.status_code == 401


# ===========================================================================
# SMED
# ===========================================================================
class TestSMEDCreate:
    @patch("app.api.routes.lean.SMEDService.create", new_callable=AsyncMock)
    async def test_create_smed_success(self, mock_create, admin_client):
        """POST /api/v1/lean/smed returns id."""
        mock_create.return_value = _mock_analysis(id=12)

        resp = await admin_client.post(
            "/api/v1/lean/smed",
            json={
                "production_line_id": 1,
                "changeover_name": "Die change on press #2",
                "baseline_time_min": 45.0,
                "steps": [
                    {
                        "step_order": 1,
                        "description": "Remove old die",
                        "duration_seconds": 300,
                        "phase": "internal",
                    }
                ],
            },
        )

        assert resp.status_code == 200
        assert resp.json()["id"] == 12

    async def test_create_smed_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean/smed",
            json={
                "production_line_id": 1,
                "changeover_name": "Test",
                "baseline_time_min": 30.0,
            },
        )
        assert resp.status_code == 401

    async def test_create_smed_missing_line_id_returns_422(self, admin_client):
        """production_line_id is required for SMED."""
        resp = await admin_client.post(
            "/api/v1/lean/smed",
            json={"changeover_name": "Test", "baseline_time_min": 30.0},
        )
        assert resp.status_code == 422

    async def test_create_smed_missing_changeover_name_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/lean/smed",
            json={"production_line_id": 1, "baseline_time_min": 30.0},
        )
        assert resp.status_code == 422


class TestSMEDPotential:
    @patch("app.api.routes.lean.SMEDService.get_improvement_potential", new_callable=AsyncMock)
    async def test_get_smed_potential_success(self, mock_potential, admin_client):
        """GET /api/v1/lean/smed/{id}/potential returns improvement data."""
        record = _mock_analysis(id=12)
        mock_potential.return_value = record

        resp = await admin_client.get("/api/v1/lean/smed/12/potential")
        assert resp.status_code == 200

    async def test_get_smed_potential_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/smed/1/potential")
        assert resp.status_code == 401


# ===========================================================================
# LEAN ASSESSMENT
# ===========================================================================
class TestAssessmentSave:
    async def test_save_assessment_success(self, admin_client, mock_db):
        """POST /api/v1/lean/assessment saves and returns id.

        NOTE: Known bug - route uses flush() without commit(), so data may
        not be persisted in a real DB. Test verifies the API contract only.
        """
        # mock_db.add is already a MagicMock; flush is AsyncMock
        # The assessment object won't have a real id from flush, so we patch it
        def _capture_add(obj):
            obj.id = 99
            obj.overall_score = 3.5

        mock_db.add = MagicMock(side_effect=_capture_add)

        resp = await admin_client.post(
            "/api/v1/lean/assessment",
            json={
                "scores": {"5s": 4.0, "kaizen": 3.0},
                "overall_score": 3.5,
                "maturity_level": "developing",
                "recommendations": ["Implement daily standups"],
                "answers": {"q1": "yes", "q2": "no"},
            },
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 99
        assert body["overall_score"] == 3.5

    async def test_save_assessment_empty_body(self, admin_client, mock_db):
        """POST with empty body should use defaults and succeed."""
        def _capture_add(obj):
            obj.id = 1
            obj.overall_score = 0

        mock_db.add = MagicMock(side_effect=_capture_add)

        resp = await admin_client.post("/api/v1/lean/assessment", json={})
        assert resp.status_code == 200

    async def test_save_assessment_anon_returns_401(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/lean/assessment",
            json={"scores": {}, "overall_score": 0},
        )
        assert resp.status_code == 401


class TestAssessmentList:
    async def test_list_assessments_success(self, admin_client, mock_db):
        """GET /api/v1/lean/assessment returns list."""
        _mock_db_scalars_all(mock_db, [])

        resp = await admin_client.get("/api/v1/lean/assessment")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_assessments_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/assessment")
        assert resp.status_code == 401


class TestAssessmentLatest:
    async def test_get_latest_assessment_success(self, admin_client, mock_db):
        """GET /api/v1/lean/assessment/latest returns latest assessment."""
        assessment = _mock_analysis(id=5, overall_score=4.2, maturity_level="advanced")
        _mock_db_scalar_one_or_none(mock_db, assessment)

        resp = await admin_client.get("/api/v1/lean/assessment/latest")
        assert resp.status_code == 200

    async def test_get_latest_assessment_none(self, admin_client, mock_db):
        """GET /api/v1/lean/assessment/latest with no assessments returns null."""
        _mock_db_scalar_one_or_none(mock_db, None)

        resp = await admin_client.get("/api/v1/lean/assessment/latest")
        assert resp.status_code == 200

    async def test_get_latest_assessment_anon_returns_401(self, anon_client):
        resp = await anon_client.get("/api/v1/lean/assessment/latest")
        assert resp.status_code == 401


# ===========================================================================
# ROLE-BASED ACCESS — viewer can read
# ===========================================================================
class TestViewerAccess:
    @patch("app.api.routes.lean.FiveWhyService.list_by_factory", new_callable=AsyncMock)
    async def test_viewer_can_list_five_why(self, mock_list, viewer_client):
        """Viewers should be able to list analyses (read-only)."""
        mock_list.return_value = []
        resp = await viewer_client.get("/api/v1/lean/five-why")
        assert resp.status_code == 200

    @patch("app.api.routes.lean.IshikawaService.list_by_factory", new_callable=AsyncMock)
    async def test_viewer_can_list_ishikawa(self, mock_list, viewer_client):
        mock_list.return_value = []
        resp = await viewer_client.get("/api/v1/lean/ishikawa")
        assert resp.status_code == 200

    @patch("app.api.routes.lean.KaizenService.get_board", new_callable=AsyncMock)
    async def test_viewer_can_view_kaizen_board(self, mock_board, viewer_client):
        mock_board.return_value = []
        resp = await viewer_client.get("/api/v1/lean/kaizen/board")
        assert resp.status_code == 200

    @patch("app.api.routes.lean.KaizenService.get_savings_summary", new_callable=AsyncMock)
    async def test_viewer_can_view_kaizen_savings(self, mock_savings, viewer_client):
        mock_savings.return_value = {"total": 0}
        resp = await viewer_client.get("/api/v1/lean/kaizen/savings")
        assert resp.status_code == 200
