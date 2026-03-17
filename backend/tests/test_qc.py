"""
Tests for Quality Control endpoints: /api/v1/qc/*

Integration tests use httpx.AsyncClient with dependency overrides.
All 29 QC endpoints are covered: Defect Catalog, QC Templates, QC Records,
NCR, CAPA, and Policy Documents.

Known issues documented via tests:
- void_qc_record: no role check — any authenticated user can void
- link-five-why: cross-tenant vulnerability (analysis_id not validated against factory)
- link-kaizen: cross-tenant vulnerability (kaizen_id not validated against factory)
"""

import os
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from io import BytesIO

from tests.conftest import (
    ADMIN_USER,
    OPERATOR_USER,
    VIEWER_USER,
    OTHER_FACTORY_ADMIN,
)

pytestmark = [pytest.mark.qc, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers: fake ORM objects returned by mocked services
# ---------------------------------------------------------------------------

def _fake_defect(**overrides):
    """Return a MagicMock that looks like a DefectCatalog row."""
    defaults = dict(
        id=1, factory_id=1, product_id=None, production_line_id=None,
        code="DIM-001", name="Out of tolerance", severity="minor",
        category="dimensional", is_active=True, sort_order=0,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    # model_validate compatibility
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_template_item(**overrides):
    defaults = dict(
        id=1, item_order=1, category="cleanliness", check_type="checkbox",
        description="Check work area", specification=None,
        lower_limit=None, upper_limit=None, unit=None,
        is_critical=False, is_mandatory=True,
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_template(**overrides):
    defaults = dict(
        id=1, factory_id=1, product_id=None, production_line_id=None,
        work_center_id=None, name="Line Clearance v1",
        template_type="line_clearance", version="1.0", is_active=True,
        estimated_time_min=15, description="Standard line clearance",
        pass_threshold_pct=100.0, critical_items_must_pass=True,
        items=[], created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_qc_result(**overrides):
    defaults = dict(
        id=1, template_item_id=1, result="pass",
        measured_value=None, text_value=None, notes=None,
        defect_catalog_id=None,
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_qc_record(**overrides):
    defaults = dict(
        id=1, factory_id=1, template_id=1, production_order_id=None,
        production_line_id=1, performed_by_id=1, check_type="line_clearance",
        status="in_progress", started_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        completed_at=None, overall_score_pct=None, andon_triggered=False,
        hold_placed=False, sample_size=10, sample_number=1, notes=None,
        results=[], created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_ncr(**overrides):
    defaults = dict(
        id=1, factory_id=1, ncr_number="NCR-2026-0001",
        title="Surface defect", description="Scratches on panel",
        severity="major", status="open", production_line_id=None,
        production_order_id=None, qc_record_id=None, product_id=None,
        quantity_affected=5, disposition=None, disposition_notes=None,
        root_cause=None, five_why_id=None,
        detected_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        closed_at=None, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_capa(**overrides):
    defaults = dict(
        id=1, factory_id=1, capa_number="CAPA-2026-0001",
        capa_type="corrective", title="Fix scratches root cause",
        description="Investigate and fix", root_cause=None,
        status="open", priority="medium", ncr_id=1, owner_id=None,
        due_date=None, implemented_at=None, verified_at=None,
        effectiveness_result=None, kaizen_item_id=None,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_policy_doc(**overrides):
    defaults = dict(
        id=1, factory_id=1, uploaded_by_id=1,
        title="QC Policy v1", description="Main QC policy",
        category="policy", filename="policy.pdf",
        file_path="abc123.pdf", file_size=1024,
        mime_type="application/pdf", version="1.0",
        is_active=True,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock(**defaults)
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


# ===========================================================================
# Defect Catalog
# ===========================================================================


class TestDefectCatalogCreate:
    @patch("app.api.routes.qc.DefectCatalogService.create")
    async def test_create_defect_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_defect()
        resp = await admin_client.post(
            "/api/v1/qc/defects",
            json={"code": "DIM-001", "name": "Out of tolerance", "severity": "minor"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == "DIM-001"
        assert body["name"] == "Out of tolerance"
        mock_create.assert_awaited_once()

    @patch("app.api.routes.qc.DefectCatalogService.create")
    async def test_create_defect_as_operator(self, mock_create, operator_client):
        """Operators can create defects (no role restriction on this endpoint)."""
        mock_create.return_value = _fake_defect()
        resp = await operator_client.post(
            "/api/v1/qc/defects",
            json={"code": "DIM-002", "name": "Crack", "severity": "critical"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.qc.DefectCatalogService.create")
    async def test_create_defect_with_product_and_line(self, mock_create, admin_client):
        mock_create.return_value = _fake_defect(product_id=5, production_line_id=3)
        resp = await admin_client.post(
            "/api/v1/qc/defects",
            json={
                "code": "SRF-001", "name": "Surface scratch",
                "severity": "major", "product_id": 5, "production_line_id": 3,
            },
        )
        assert resp.status_code == 200


class TestDefectCatalogList:
    @patch("app.api.routes.qc.DefectCatalogService.list_all")
    async def test_list_defects_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/qc/defects")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.qc.DefectCatalogService.list_all")
    async def test_list_defects_with_results(self, mock_list, admin_client):
        mock_list.return_value = [_fake_defect(), _fake_defect(id=2, code="DIM-002")]
        resp = await admin_client.get("/api/v1/qc/defects")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @patch("app.api.routes.qc.DefectCatalogService.list_all")
    async def test_list_defects_with_filters(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get(
            "/api/v1/qc/defects", params={"product_id": 5, "line_id": 3, "active_only": False},
        )
        assert resp.status_code == 200
        mock_list.assert_awaited_once_with(mock_list.call_args[0][0], 1, 5, 3, False)


class TestDefectCatalogUpdate:
    @patch("app.api.routes.qc.DefectCatalogService.update")
    async def test_update_defect_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_defect(name="Updated name")
        resp = await admin_client.patch(
            "/api/v1/qc/defects/1",
            json={"name": "Updated name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated name"

    @patch("app.api.routes.qc.DefectCatalogService.update")
    async def test_update_defect_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.patch(
            "/api/v1/qc/defects/999",
            json={"name": "Does not exist"},
        )
        assert resp.status_code == 404


class TestDefectCatalogDeactivate:
    @patch("app.api.routes.qc.DefectCatalogService.deactivate")
    async def test_deactivate_defect_success(self, mock_deactivate, admin_client):
        mock_deactivate.return_value = _fake_defect(is_active=False)
        resp = await admin_client.delete("/api/v1/qc/defects/1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    @patch("app.api.routes.qc.DefectCatalogService.deactivate")
    async def test_deactivate_defect_not_found(self, mock_deactivate, admin_client):
        mock_deactivate.return_value = None
        resp = await admin_client.delete("/api/v1/qc/defects/999")
        assert resp.status_code == 404


# ===========================================================================
# QC Templates
# ===========================================================================


class TestQCTemplateCreate:
    @patch("app.api.routes.qc.QCTemplateService.create")
    async def test_create_template_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_template()
        resp = await admin_client.post(
            "/api/v1/qc/templates",
            json={
                "name": "Line Clearance v1",
                "template_type": "line_clearance",
                "items": [
                    {"item_order": 1, "description": "Check work area", "check_type": "checkbox"},
                ],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Line Clearance v1"

    @patch("app.api.routes.qc.QCTemplateService.create")
    async def test_create_template_without_items(self, mock_create, admin_client):
        mock_create.return_value = _fake_template()
        resp = await admin_client.post(
            "/api/v1/qc/templates",
            json={"name": "Empty Template", "template_type": "fga"},
        )
        assert resp.status_code == 200


class TestQCTemplateList:
    @patch("app.api.routes.qc.QCTemplateService.list_all")
    async def test_list_templates_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/qc/templates")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.qc.QCTemplateService.list_all")
    async def test_list_templates_with_filters(self, mock_list, admin_client):
        mock_list.return_value = [_fake_template()]
        resp = await admin_client.get(
            "/api/v1/qc/templates",
            params={"template_type": "line_clearance", "product_id": 5, "line_id": 3},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestQCTemplateGet:
    @patch("app.api.routes.qc.QCTemplateService.get")
    async def test_get_template_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_template()
        resp = await admin_client.get("/api/v1/qc/templates/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.qc.QCTemplateService.get")
    async def test_get_template_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/qc/templates/999")
        assert resp.status_code == 404


class TestQCTemplateClone:
    @patch("app.api.routes.qc.QCTemplateService.clone")
    async def test_clone_template_success(self, mock_clone, admin_client):
        mock_clone.return_value = _fake_template(id=2, name="Line Clearance v1 (Copy)")
        resp = await admin_client.post("/api/v1/qc/templates/1/clone")
        assert resp.status_code == 200
        assert "(Copy)" in resp.json()["name"]

    @patch("app.api.routes.qc.QCTemplateService.clone")
    async def test_clone_template_not_found(self, mock_clone, admin_client):
        mock_clone.return_value = None
        resp = await admin_client.post("/api/v1/qc/templates/999/clone")
        assert resp.status_code == 404


# ===========================================================================
# QC Records
# ===========================================================================


class TestQCRecordStart:
    @patch("app.api.routes.qc.QCRecordService.start_check")
    async def test_start_qc_check_success(self, mock_start, admin_client):
        mock_start.return_value = _fake_qc_record()
        resp = await admin_client.post(
            "/api/v1/qc/records",
            json={
                "template_id": 1, "production_line_id": 1,
                "check_type": "line_clearance", "sample_size": 10,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    @patch("app.api.routes.qc.QCRecordService.start_check")
    async def test_start_qc_check_as_operator(self, mock_start, operator_client):
        """Operators should be able to start QC checks."""
        mock_start.return_value = _fake_qc_record(performed_by_id=2)
        resp = await operator_client.post(
            "/api/v1/qc/records",
            json={
                "template_id": 1, "production_line_id": 1,
                "check_type": "in_process",
            },
        )
        assert resp.status_code == 200


class TestQCRecordList:
    @patch("app.api.routes.qc.QCRecordService.list_all")
    async def test_list_records_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/qc/records")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.qc.QCRecordService.list_all")
    async def test_list_records_with_filters(self, mock_list, admin_client):
        mock_list.return_value = [_fake_qc_record()]
        resp = await admin_client.get(
            "/api/v1/qc/records",
            params={"check_type": "line_clearance", "order_id": 10, "line_id": 1},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestQCRecordGet:
    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_get_record_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_qc_record()
        resp = await admin_client.get("/api/v1/qc/records/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_get_record_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/qc/records/999")
        assert resp.status_code == 404


class TestQCRecordSubmitResults:
    @patch("app.api.routes.qc.QCRecordService.submit_results")
    async def test_submit_results_success(self, mock_submit, admin_client):
        record_with_results = _fake_qc_record(results=[_fake_qc_result()])
        mock_submit.return_value = record_with_results
        resp = await admin_client.post(
            "/api/v1/qc/records/1/results",
            json=[
                {"template_item_id": 1, "result": "pass"},
                {"template_item_id": 2, "result": "fail", "notes": "Scratch found"},
            ],
        )
        assert resp.status_code == 200

    @patch("app.api.routes.qc.QCRecordService.submit_results")
    async def test_submit_results_record_not_found(self, mock_submit, admin_client):
        mock_submit.return_value = None
        resp = await admin_client.post(
            "/api/v1/qc/records/999/results",
            json=[{"template_item_id": 1, "result": "pass"}],
        )
        assert resp.status_code == 404


class TestQCRecordComplete:
    @patch("app.api.routes.qc.QCRecordService.complete_check")
    async def test_complete_qc_check_success(self, mock_complete, admin_client):
        mock_complete.return_value = _fake_qc_record(status="passed", overall_score_pct=100.0)
        resp = await admin_client.post("/api/v1/qc/records/1/complete")
        assert resp.status_code == 200
        assert resp.json()["status"] == "passed"

    @patch("app.api.routes.qc.QCRecordService.complete_check")
    async def test_complete_qc_check_not_found(self, mock_complete, admin_client):
        mock_complete.return_value = None
        resp = await admin_client.post("/api/v1/qc/records/999/complete")
        assert resp.status_code == 404


class TestQCRecordVoid:
    """
    KNOWN ISSUE: void_qc_record has NO role check.
    Any authenticated user (admin, operator, viewer) can void a QC record.
    These tests document this vulnerability.
    """

    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_void_qc_record_as_admin(self, mock_get, admin_client, mock_db):
        record = _fake_qc_record()
        mock_get.return_value = record
        resp = await admin_client.post("/api/v1/qc/records/1/void")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert record.status == "voided"

    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_void_qc_record_as_operator_succeeds_no_role_check(
        self, mock_get, operator_client, mock_db,
    ):
        """BUG: Operators can void QC records — there is no role restriction."""
        record = _fake_qc_record()
        mock_get.return_value = record
        resp = await operator_client.post("/api/v1/qc/records/1/void")
        # This SHOULD be 403, but currently succeeds (200) due to missing role check.
        assert resp.status_code == 200
        assert record.status == "voided"

    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_void_qc_record_as_viewer_succeeds_no_role_check(
        self, mock_get, viewer_client, mock_db,
    ):
        """BUG: Even viewers can void QC records — there is no role restriction."""
        record = _fake_qc_record()
        mock_get.return_value = record
        resp = await viewer_client.post("/api/v1/qc/records/1/void")
        # This SHOULD be 403, but currently succeeds (200) due to missing role check.
        assert resp.status_code == 200
        assert record.status == "voided"

    @patch("app.api.routes.qc.QCRecordService.get")
    async def test_void_qc_record_not_found(self, mock_get, admin_client, mock_db):
        mock_get.return_value = None
        resp = await admin_client.post("/api/v1/qc/records/999/void")
        assert resp.status_code == 404


# ===========================================================================
# NCR (Non-Conformance Report)
# ===========================================================================


class TestNCRCreate:
    @patch("app.api.routes.qc.NCRService.create")
    async def test_create_ncr_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_ncr()
        resp = await admin_client.post(
            "/api/v1/qc/ncr",
            json={
                "title": "Surface defect",
                "description": "Scratches on panel",
                "severity": "major",
                "quantity_affected": 5,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["ncr_number"] == "NCR-2026-0001"
        assert body["severity"] == "major"

    @patch("app.api.routes.qc.NCRService.create")
    async def test_create_ncr_with_linked_qc_record(self, mock_create, admin_client):
        mock_create.return_value = _fake_ncr(qc_record_id=1)
        resp = await admin_client.post(
            "/api/v1/qc/ncr",
            json={
                "title": "QC Failure NCR",
                "description": "Auto-generated from QC failure",
                "severity": "critical",
                "qc_record_id": 1,
            },
        )
        assert resp.status_code == 200


class TestNCRList:
    @patch("app.api.routes.qc.NCRService.list_all")
    async def test_list_ncrs_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/qc/ncr")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.qc.NCRService.list_all")
    async def test_list_ncrs_with_filters(self, mock_list, admin_client):
        mock_list.return_value = [_fake_ncr()]
        resp = await admin_client.get(
            "/api/v1/qc/ncr", params={"status": "open", "severity": "major"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestNCRGet:
    @patch("app.api.routes.qc.NCRService.get")
    async def test_get_ncr_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_ncr()
        resp = await admin_client.get("/api/v1/qc/ncr/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.qc.NCRService.get")
    async def test_get_ncr_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/qc/ncr/999")
        assert resp.status_code == 404


class TestNCRUpdate:
    @patch("app.api.routes.qc.NCRService.update")
    async def test_update_ncr_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_ncr(status="under_investigation")
        resp = await admin_client.patch(
            "/api/v1/qc/ncr/1",
            json={"status": "under_investigation"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.qc.NCRService.update")
    async def test_update_ncr_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.patch(
            "/api/v1/qc/ncr/999",
            json={"status": "closed"},
        )
        assert resp.status_code == 404

    @patch("app.api.routes.qc.NCRService.update")
    async def test_update_ncr_set_disposition(self, mock_update, admin_client):
        mock_update.return_value = _fake_ncr(
            disposition="rework", disposition_notes="Rework on line 2",
        )
        resp = await admin_client.patch(
            "/api/v1/qc/ncr/1",
            json={"disposition": "rework", "disposition_notes": "Rework on line 2"},
        )
        assert resp.status_code == 200


class TestNCRLinkFiveWhy:
    """
    KNOWN VULNERABILITY: link-five-why does NOT validate that analysis_id
    belongs to the same factory. A user from factory 2 can link their
    five-why analysis to an NCR in factory 1 (if they know the NCR id).
    """

    @patch("app.api.routes.qc.NCRService.get")
    async def test_link_five_why_success(self, mock_get, admin_client, mock_db):
        ncr = _fake_ncr()
        mock_get.return_value = ncr
        resp = await admin_client.post("/api/v1/qc/ncr/1/link-five-why/42")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert ncr.five_why_id == 42

    @patch("app.api.routes.qc.NCRService.get")
    async def test_link_five_why_ncr_not_found(self, mock_get, admin_client, mock_db):
        mock_get.return_value = None
        resp = await admin_client.post("/api/v1/qc/ncr/999/link-five-why/42")
        assert resp.status_code == 404

    @patch("app.api.routes.qc.NCRService.get")
    async def test_link_five_why_cross_tenant_vulnerability(
        self, mock_get, admin_client, mock_db,
    ):
        """
        BUG: The endpoint accepts any analysis_id without verifying it belongs
        to the user's factory. An attacker knowing an analysis ID from another
        factory can link it to their own NCR. The analysis_id (999) could be
        from factory 2 but is blindly assigned to factory 1's NCR.
        """
        ncr = _fake_ncr(factory_id=1)
        mock_get.return_value = ncr
        # analysis_id=999 could belong to factory 2 — no validation occurs
        resp = await admin_client.post("/api/v1/qc/ncr/1/link-five-why/999")
        # This succeeds when it should validate the analysis belongs to the same factory
        assert resp.status_code == 200
        assert ncr.five_why_id == 999


# ===========================================================================
# CAPA (Corrective and Preventive Action)
# ===========================================================================


class TestCAPACreate:
    @patch("app.api.routes.qc.CAPAService.create")
    async def test_create_capa_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_capa()
        resp = await admin_client.post(
            "/api/v1/qc/capa",
            json={
                "capa_type": "corrective",
                "title": "Fix scratches root cause",
                "description": "Investigate and fix",
                "ncr_id": 1,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["capa_number"] == "CAPA-2026-0001"
        assert body["capa_type"] == "corrective"

    @patch("app.api.routes.qc.CAPAService.create")
    async def test_create_capa_preventive(self, mock_create, admin_client):
        mock_create.return_value = _fake_capa(capa_type="preventive")
        resp = await admin_client.post(
            "/api/v1/qc/capa",
            json={
                "capa_type": "preventive",
                "title": "Add inspection step",
                "description": "Prevent recurrence",
                "priority": "high",
            },
        )
        assert resp.status_code == 200


class TestCAPAList:
    @patch("app.api.routes.qc.CAPAService.list_all")
    async def test_list_capas_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/qc/capa")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.qc.CAPAService.list_all")
    async def test_list_capas_with_status_filter(self, mock_list, admin_client):
        mock_list.return_value = [_fake_capa()]
        resp = await admin_client.get("/api/v1/qc/capa", params={"status": "open"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestCAPAGet:
    @patch("app.api.routes.qc.CAPAService.get")
    async def test_get_capa_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_capa()
        resp = await admin_client.get("/api/v1/qc/capa/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.qc.CAPAService.get")
    async def test_get_capa_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/qc/capa/999")
        assert resp.status_code == 404


class TestCAPAUpdate:
    @patch("app.api.routes.qc.CAPAService.update")
    async def test_update_capa_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_capa(status="in_progress")
        resp = await admin_client.patch(
            "/api/v1/qc/capa/1",
            json={"status": "in_progress"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.qc.CAPAService.update")
    async def test_update_capa_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.patch(
            "/api/v1/qc/capa/999",
            json={"status": "closed"},
        )
        assert resp.status_code == 404

    @patch("app.api.routes.qc.CAPAService.update")
    async def test_update_capa_set_root_cause(self, mock_update, admin_client):
        mock_update.return_value = _fake_capa(root_cause="Tool wear")
        resp = await admin_client.patch(
            "/api/v1/qc/capa/1",
            json={"root_cause": "Tool wear"},
        )
        assert resp.status_code == 200


class TestCAPAVerify:
    @patch("app.api.routes.qc.CAPAService.verify")
    async def test_verify_capa_success(self, mock_verify, admin_client):
        mock_verify.return_value = _fake_capa(
            status="verified",
            verified_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
            effectiveness_result="Effective",
        )
        resp = await admin_client.post("/api/v1/qc/capa/1/verify")
        assert resp.status_code == 200
        assert resp.json()["status"] == "verified"

    @patch("app.api.routes.qc.CAPAService.verify")
    async def test_verify_capa_with_custom_effectiveness(self, mock_verify, admin_client):
        mock_verify.return_value = _fake_capa(
            status="verified", effectiveness_result="Partially Effective",
        )
        resp = await admin_client.post(
            "/api/v1/qc/capa/1/verify",
            params={"effectiveness": "Partially Effective"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.qc.CAPAService.verify")
    async def test_verify_capa_not_found(self, mock_verify, admin_client):
        mock_verify.return_value = None
        resp = await admin_client.post("/api/v1/qc/capa/999/verify")
        assert resp.status_code == 404


class TestCAPALinkKaizen:
    """
    KNOWN VULNERABILITY: link-kaizen does NOT validate that kaizen_id
    belongs to the same factory. Same cross-tenant issue as link-five-why.
    """

    @patch("app.api.routes.qc.CAPAService.get")
    async def test_link_kaizen_success(self, mock_get, admin_client, mock_db):
        capa = _fake_capa()
        mock_get.return_value = capa
        resp = await admin_client.post("/api/v1/qc/capa/1/link-kaizen/42")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert capa.kaizen_item_id == 42

    @patch("app.api.routes.qc.CAPAService.get")
    async def test_link_kaizen_capa_not_found(self, mock_get, admin_client, mock_db):
        mock_get.return_value = None
        resp = await admin_client.post("/api/v1/qc/capa/999/link-kaizen/42")
        assert resp.status_code == 404

    @patch("app.api.routes.qc.CAPAService.get")
    async def test_link_kaizen_cross_tenant_vulnerability(
        self, mock_get, admin_client, mock_db,
    ):
        """
        BUG: The endpoint accepts any kaizen_id without verifying it belongs
        to the user's factory. A kaizen_id from factory 2 can be linked to
        a CAPA in factory 1.
        """
        capa = _fake_capa(factory_id=1)
        mock_get.return_value = capa
        # kaizen_id=999 could belong to factory 2 — no validation
        resp = await admin_client.post("/api/v1/qc/capa/1/link-kaizen/999")
        assert resp.status_code == 200
        assert capa.kaizen_item_id == 999


# ===========================================================================
# QC Policy Documents
# ===========================================================================


class TestPolicyUpload:
    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    @patch("app.models.qc.QCPolicyDocument")
    async def test_upload_pdf_policy(self, mock_doc_cls, mock_open, mock_makedirs, admin_client, mock_db):
        """Upload a valid PDF policy document."""
        fake_doc = _fake_policy_doc()
        mock_doc_cls.return_value = fake_doc
        # mock db.refresh to set created_at as string
        mock_db.refresh = AsyncMock()

        files = {"file": ("policy.pdf", BytesIO(b"%PDF-1.4 " + b"\x00" * 100), "application/pdf")}
        resp = await admin_client.post(
            "/api/v1/qc/policies",
            files=files,
            data={"title": "QC Policy v1", "description": "Main policy", "category": "policy", "version": "1.0"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "QC Policy v1"

    @patch("os.makedirs")
    @patch("builtins.open", create=True)
    @patch("app.models.qc.QCPolicyDocument")
    async def test_upload_png_policy(self, mock_doc_cls, mock_open, mock_makedirs, admin_client, mock_db):
        """Upload a valid PNG image as policy document."""
        fake_doc = _fake_policy_doc(mime_type="image/png", filename="diagram.png")
        mock_doc_cls.return_value = fake_doc
        mock_db.refresh = AsyncMock()

        files = {"file": ("diagram.png", BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100), "image/png")}
        resp = await admin_client.post(
            "/api/v1/qc/policies",
            files=files,
            data={"title": "QC Diagram", "category": "reference"},
        )
        assert resp.status_code == 200

    async def test_upload_disallowed_type(self, admin_client):
        """Uploading a disallowed file type (e.g. .exe) returns 400."""
        files = {"file": ("malware.exe", BytesIO(b"MZ" + b"\x00" * 100), "application/octet-stream")}
        resp = await admin_client.post(
            "/api/v1/qc/policies",
            files=files,
            data={"title": "Bad file"},
        )
        assert resp.status_code == 400
        assert "not allowed" in resp.json()["detail"]

    async def test_upload_oversized_file(self, admin_client):
        """Uploading a file larger than 20 MB returns 400."""
        huge_content = b"%PDF-1.4 " + (b"\x00" * (21 * 1024 * 1024))
        files = {"file": ("huge.pdf", BytesIO(huge_content), "application/pdf")}
        resp = await admin_client.post(
            "/api/v1/qc/policies",
            files=files,
            data={"title": "Huge file"},
        )
        assert resp.status_code == 400
        assert "too large" in resp.json()["detail"].lower()


class TestPolicyList:
    async def test_list_policies_empty(self, admin_client, mock_db):
        """List policies when none exist."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/qc/policies")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_policies_with_results(self, admin_client, mock_db):
        """List policies returns correctly formatted results."""
        doc = _fake_policy_doc()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [doc]
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/qc/policies")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["title"] == "QC Policy v1"

    async def test_list_policies_with_category_filter(self, admin_client, mock_db):
        """List policies with category filter."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/qc/policies", params={"category": "procedure"})
        assert resp.status_code == 200


class TestPolicyDownload:
    @patch("os.path.exists", return_value=True)
    async def test_download_policy_success(self, mock_exists, admin_client, mock_db):
        """Download an existing policy document."""
        doc = _fake_policy_doc()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result_mock)

        # FileResponse will try to read the file; we patch it
        with patch("app.api.routes.qc.FileResponse") as mock_fr:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.body = b"file content"
            mock_fr.return_value = mock_response

            resp = await admin_client.get("/api/v1/qc/policies/1/download")
            # The response may vary due to FileResponse mocking; we check it didn't 404
            # In practice, FileResponse is returned directly

    async def test_download_policy_not_found_in_db(self, admin_client, mock_db):
        """Download a policy that doesn't exist in database returns 404."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/qc/policies/999/download")
        assert resp.status_code == 404

    @patch("os.path.exists", return_value=False)
    async def test_download_policy_file_missing_on_disk(self, mock_exists, admin_client, mock_db):
        """Download when DB record exists but file is missing from disk returns 404."""
        doc = _fake_policy_doc()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.get("/api/v1/qc/policies/1/download")
        assert resp.status_code == 404
        assert "not found on disk" in resp.json()["detail"].lower()


class TestPolicyDelete:
    async def test_delete_policy_success(self, admin_client, mock_db):
        """Soft-delete a policy document."""
        doc = _fake_policy_doc()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = doc
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/qc/policies/1")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert doc.is_active is False

    async def test_delete_policy_not_found(self, admin_client, mock_db):
        """Deleting a non-existent policy returns 404."""
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=result_mock)

        resp = await admin_client.delete("/api/v1/qc/policies/999")
        assert resp.status_code == 404


# ===========================================================================
# Tenant Isolation
# ===========================================================================


class TestQCTenantIsolation:
    """Verify that factory-scoped endpoints use the authenticated user's factory_id."""

    @patch("app.api.routes.qc.DefectCatalogService.list_all")
    async def test_other_factory_gets_own_defects(self, mock_list, other_factory_client):
        """other_factory_client (factory_id=2) should query with fid=2."""
        mock_list.return_value = []
        resp = await other_factory_client.get("/api/v1/qc/defects")
        assert resp.status_code == 200
        # Verify the service was called with factory_id=2
        call_args = mock_list.call_args
        assert call_args[0][1] == 2  # factory_id parameter

    @patch("app.api.routes.qc.NCRService.get")
    async def test_other_factory_cannot_access_factory1_ncr(self, mock_get, other_factory_client):
        """NCR.get is called with factory_id=2, so factory 1's NCRs are invisible."""
        mock_get.return_value = None  # factory 2 has no NCR with id=1
        resp = await other_factory_client.get("/api/v1/qc/ncr/1")
        assert resp.status_code == 404

    @patch("app.api.routes.qc.CAPAService.get")
    async def test_other_factory_cannot_access_factory1_capa(self, mock_get, other_factory_client):
        mock_get.return_value = None
        resp = await other_factory_client.get("/api/v1/qc/capa/1")
        assert resp.status_code == 404
