"""
Tests for manufacturing endpoints: /api/v1/manufacturing/*

Covers Products, Work Centers, BOM, and Production Orders.
Integration tests use httpx.AsyncClient with dependency overrides.
"""

import io
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from openpyxl import Workbook

from tests.conftest import ADMIN_USER, OPERATOR_USER, VIEWER_USER


pytestmark = [pytest.mark.manufacturing, pytest.mark.integration]


# ---------------------------------------------------------------------------
# Helpers — mock objects that mimic SQLAlchemy model instances
# ---------------------------------------------------------------------------

def _fake_product(**overrides):
    """Return a MagicMock that behaves like a Product ORM object."""
    defaults = dict(
        id=1,
        factory_id=1,
        code="SKU-001",
        name="Widget Alpha",
        description="A test widget",
        unit_of_measure="pcs",
        product_family="Widgets",
        is_active=True,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_work_center(**overrides):
    defaults = dict(
        id=1,
        factory_id=1,
        production_line_id=1,
        name="CNC Mill 01",
        description="3-axis CNC",
        machine_type="CNC",
        capacity_units_per_hour=120.0,
        is_active=True,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_bom_component(**overrides):
    defaults = dict(
        id=1,
        sequence=1,
        material_code="MAT-001",
        material_name="Steel Sheet 2mm",
        quantity_per_unit=2.5,
        unit_of_measure="kg",
        is_critical=False,
        notes=None,
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_bom(**overrides):
    defaults = dict(
        id=1,
        factory_id=1,
        product_id=1,
        production_line_id=1,
        version="1.0",
        is_active=True,
        ideal_cycle_time_sec=45.0,
        batch_size=None,
        approved_by_id=None,
        approved_at=None,
        notes=None,
        components=[_fake_bom_component()],
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    return obj


def _fake_production_order(**overrides):
    defaults = dict(
        id=1,
        factory_id=1,
        production_line_id=1,
        product_id=1,
        bom_id=1,
        order_number="PO-2025-0001",
        status="planned",
        planned_quantity=100,
        actual_quantity_good=0,
        actual_quantity_scrap=0,
        planned_start=datetime(2025, 6, 1, tzinfo=timezone.utc),
        planned_end=datetime(2025, 6, 2, tzinfo=timezone.utc),
        actual_start=None,
        actual_end=None,
        customer_ref=None,
        notes=None,
        qc_hold=False,
        qc_hold_reason=None,
        product_name=None,
        line_name=None,
        progress_pct=None,
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    obj = MagicMock()
    for k, v in defaults.items():
        setattr(obj, k, v)
    # model_dump(exclude_unset=True) support is not needed — routes use data.model_dump
    return obj


def _build_excel_bytes(rows, headers=None):
    """Build a minimal .xlsx file in memory and return bytes."""
    wb = Workbook()
    ws = wb.active
    if headers:
        ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ═══════════════════════════════════════════════════════════════════════════
# Products
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateProduct:
    """POST /api/v1/manufacturing/products"""

    @patch("app.api.routes.manufacturing.ProductService.create", new_callable=AsyncMock)
    async def test_create_product_success(self, mock_create, admin_client):
        product = _fake_product()
        mock_create.return_value = product

        resp = await admin_client.post(
            "/api/v1/manufacturing/products",
            json={"code": "SKU-001", "name": "Widget Alpha"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == "SKU-001"
        assert body["name"] == "Widget Alpha"
        mock_create.assert_awaited_once()

    @patch("app.api.routes.manufacturing.ProductService.create", new_callable=AsyncMock)
    async def test_create_product_all_fields(self, mock_create, admin_client):
        product = _fake_product(description="Full product", unit_of_measure="kg", product_family="Raw")
        mock_create.return_value = product

        resp = await admin_client.post(
            "/api/v1/manufacturing/products",
            json={
                "code": "SKU-001",
                "name": "Widget Alpha",
                "description": "Full product",
                "unit_of_measure": "kg",
                "product_family": "Raw",
                "is_active": True,
            },
        )
        assert resp.status_code == 200

    async def test_create_product_missing_code_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/products",
            json={"name": "Widget Alpha"},
        )
        assert resp.status_code == 422

    async def test_create_product_missing_name_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/products",
            json={"code": "SKU-001"},
        )
        assert resp.status_code == 422

    async def test_create_product_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/products",
            json={"code": "SKU-001", "name": "Widget Alpha"},
        )
        assert resp.status_code == 401


class TestListProducts:
    """GET /api/v1/manufacturing/products"""

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_list_products_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/products")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_list_products_returns_items(self, mock_list, admin_client):
        mock_list.return_value = [_fake_product(), _fake_product(id=2, code="SKU-002", name="Widget Beta")]
        resp = await admin_client.get("/api/v1/manufacturing/products")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_list_products_active_only_param(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/products?active_only=false")
        assert resp.status_code == 200
        mock_list.assert_awaited_once_with(
            pytest.approx(mock_list.call_args[0][0], abs=0),  # db session
            1,  # factory_id
            False,
        )

    async def test_list_products_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/products")
        assert resp.status_code == 401

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_list_products_viewer_can_access(self, mock_list, viewer_client):
        mock_list.return_value = []
        resp = await viewer_client.get("/api/v1/manufacturing/products")
        assert resp.status_code == 200


class TestGetProduct:
    """GET /api/v1/manufacturing/products/{product_id}"""

    @patch("app.api.routes.manufacturing.ProductService.get", new_callable=AsyncMock)
    async def test_get_product_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_product()
        resp = await admin_client.get("/api/v1/manufacturing/products/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.manufacturing.ProductService.get", new_callable=AsyncMock)
    async def test_get_product_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/manufacturing/products/999")
        assert resp.status_code == 404

    async def test_get_product_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/products/1")
        assert resp.status_code == 401

    async def test_get_product_invalid_id_returns_422(self, admin_client):
        resp = await admin_client.get("/api/v1/manufacturing/products/abc")
        assert resp.status_code == 422


class TestUpdateProduct:
    """PATCH /api/v1/manufacturing/products/{product_id}"""

    @patch("app.api.routes.manufacturing.ProductService.update", new_callable=AsyncMock)
    async def test_update_product_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_product(name="Updated Widget")
        resp = await admin_client.patch(
            "/api/v1/manufacturing/products/1",
            json={"name": "Updated Widget"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Widget"

    @patch("app.api.routes.manufacturing.ProductService.update", new_callable=AsyncMock)
    async def test_update_product_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.patch(
            "/api/v1/manufacturing/products/999",
            json={"name": "Nope"},
        )
        assert resp.status_code == 404

    async def test_update_product_no_auth(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/manufacturing/products/1",
            json={"name": "Hacker"},
        )
        assert resp.status_code == 401

    async def test_update_product_empty_body_ok(self, admin_client):
        """PATCH with empty JSON body should be valid (all fields optional)."""
        with patch(
            "app.api.routes.manufacturing.ProductService.update",
            new_callable=AsyncMock,
            return_value=_fake_product(),
        ):
            resp = await admin_client.patch(
                "/api/v1/manufacturing/products/1",
                json={},
            )
            assert resp.status_code == 200


class TestDownloadProductTemplate:
    """GET /api/v1/manufacturing/products/template/download"""

    async def test_download_template_success(self, admin_client):
        resp = await admin_client.get("/api/v1/manufacturing/products/template/download")
        assert resp.status_code == 200
        assert "spreadsheetml" in resp.headers.get("content-type", "")
        assert "product_template.xlsx" in resp.headers.get("content-disposition", "")

    async def test_download_template_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/products/template/download")
        assert resp.status_code == 401

    async def test_download_template_viewer_can_access(self, viewer_client):
        resp = await viewer_client.get("/api/v1/manufacturing/products/template/download")
        assert resp.status_code == 200


class TestImportProductsExcel:
    """POST /api/v1/manufacturing/products/import"""

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    @patch("app.api.routes.manufacturing.ProductService.create", new_callable=AsyncMock)
    async def test_import_success(self, mock_create, mock_list, admin_client):
        mock_list.return_value = []  # no existing products
        mock_create.return_value = _fake_product()

        excel_bytes = _build_excel_bytes(
            [("SKU-100", "Import Widget", "desc", "pcs", "Widgets")],
            headers=["code", "name", "description", "unit_of_measure", "product_family"],
        )

        resp = await admin_client.post(
            "/api/v1/manufacturing/products/import",
            files={"file": ("products.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["created"] >= 1
        assert "errors" in body

    async def test_import_non_excel_returns_400(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/products/import",
            files={"file": ("products.csv", b"code,name\nSKU,Widget", "text/csv")},
        )
        assert resp.status_code == 400

    async def test_import_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/products/import",
            files={"file": ("products.xlsx", b"fake", "application/octet-stream")},
        )
        assert resp.status_code == 401

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_import_skips_duplicates(self, mock_list, admin_client):
        existing = _fake_product(code="SKU-100")
        mock_list.return_value = [existing]

        excel_bytes = _build_excel_bytes(
            [("SKU-100", "Duplicate", "desc", "pcs", "Widgets")],
            headers=["code", "name", "description", "unit_of_measure", "product_family"],
        )

        resp = await admin_client.post(
            "/api/v1/manufacturing/products/import",
            files={"file": ("products.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["skipped"] >= 1
        assert body["created"] == 0


# ═══════════════════════════════════════════════════════════════════════════
# Work Centers
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateWorkCenter:
    """POST /api/v1/manufacturing/work-centers"""

    @patch("app.api.routes.manufacturing.WorkCenterService.create", new_callable=AsyncMock)
    async def test_create_work_center_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_work_center()
        resp = await admin_client.post(
            "/api/v1/manufacturing/work-centers",
            json={"production_line_id": 1, "name": "CNC Mill 01"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "CNC Mill 01"

    async def test_create_work_center_missing_name_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/work-centers",
            json={"production_line_id": 1},
        )
        assert resp.status_code == 422

    async def test_create_work_center_missing_line_id_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/work-centers",
            json={"name": "CNC Mill 01"},
        )
        assert resp.status_code == 422

    async def test_create_work_center_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/work-centers",
            json={"production_line_id": 1, "name": "CNC Mill 01"},
        )
        assert resp.status_code == 401


class TestListWorkCenters:
    """GET /api/v1/manufacturing/work-centers"""

    @patch("app.api.routes.manufacturing.WorkCenterService.list_all", new_callable=AsyncMock)
    async def test_list_work_centers_success(self, mock_list, admin_client):
        mock_list.return_value = [_fake_work_center()]
        resp = await admin_client.get("/api/v1/manufacturing/work-centers")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("app.api.routes.manufacturing.WorkCenterService.list_all", new_callable=AsyncMock)
    async def test_list_work_centers_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/work-centers")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.manufacturing.WorkCenterService.list_all", new_callable=AsyncMock)
    async def test_list_work_centers_filter_by_line(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/work-centers?line_id=5")
        assert resp.status_code == 200

    async def test_list_work_centers_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/work-centers")
        assert resp.status_code == 401


class TestUpdateWorkCenter:
    """PATCH /api/v1/manufacturing/work-centers/{wc_id}"""

    @patch("app.api.routes.manufacturing.WorkCenterService.update", new_callable=AsyncMock)
    async def test_update_work_center_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_work_center(name="Updated Mill")
        resp = await admin_client.patch(
            "/api/v1/manufacturing/work-centers/1",
            json={"name": "Updated Mill"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Mill"

    @patch("app.api.routes.manufacturing.WorkCenterService.update", new_callable=AsyncMock)
    async def test_update_work_center_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.patch(
            "/api/v1/manufacturing/work-centers/999",
            json={"name": "Ghost"},
        )
        assert resp.status_code == 404

    async def test_update_work_center_no_auth(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/manufacturing/work-centers/1",
            json={"name": "Hacker"},
        )
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════
# BOM
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateBOM:
    """POST /api/v1/manufacturing/bom"""

    @patch("app.api.routes.manufacturing.BOMService.create", new_callable=AsyncMock)
    async def test_create_bom_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_bom()
        resp = await admin_client.post(
            "/api/v1/manufacturing/bom",
            json={
                "product_id": 1,
                "production_line_id": 1,
                "ideal_cycle_time_sec": 45.0,
                "components": [
                    {
                        "material_name": "Steel Sheet 2mm",
                        "quantity_per_unit": 2.5,
                    }
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == 1
        assert body["ideal_cycle_time_sec"] == 45.0

    async def test_create_bom_missing_product_id_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/bom",
            json={
                "production_line_id": 1,
                "ideal_cycle_time_sec": 45.0,
            },
        )
        assert resp.status_code == 422

    async def test_create_bom_missing_cycle_time_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/bom",
            json={
                "product_id": 1,
                "production_line_id": 1,
            },
        )
        assert resp.status_code == 422

    async def test_create_bom_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/bom",
            json={
                "product_id": 1,
                "production_line_id": 1,
                "ideal_cycle_time_sec": 45.0,
            },
        )
        assert resp.status_code == 401

    @patch("app.api.routes.manufacturing.BOMService.create", new_callable=AsyncMock)
    async def test_create_bom_without_components(self, mock_create, admin_client):
        mock_create.return_value = _fake_bom(components=[])
        resp = await admin_client.post(
            "/api/v1/manufacturing/bom",
            json={
                "product_id": 1,
                "production_line_id": 1,
                "ideal_cycle_time_sec": 30.0,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["components"] == []


class TestListBOMs:
    """GET /api/v1/manufacturing/bom"""

    @patch("app.api.routes.manufacturing.BOMService.list_all", new_callable=AsyncMock)
    async def test_list_boms_success(self, mock_list, admin_client):
        mock_list.return_value = [_fake_bom()]
        resp = await admin_client.get("/api/v1/manufacturing/bom")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("app.api.routes.manufacturing.BOMService.list_all", new_callable=AsyncMock)
    async def test_list_boms_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/bom")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.manufacturing.BOMService.list_all", new_callable=AsyncMock)
    async def test_list_boms_filter_product(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/bom?product_id=1")
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.BOMService.list_all", new_callable=AsyncMock)
    async def test_list_boms_filter_line(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/bom?line_id=2")
        assert resp.status_code == 200

    async def test_list_boms_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/bom")
        assert resp.status_code == 401


class TestGetBOM:
    """GET /api/v1/manufacturing/bom/{bom_id}"""

    @patch("app.api.routes.manufacturing.BOMService.get", new_callable=AsyncMock)
    async def test_get_bom_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_bom()
        resp = await admin_client.get("/api/v1/manufacturing/bom/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.manufacturing.BOMService.get", new_callable=AsyncMock)
    async def test_get_bom_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/manufacturing/bom/999")
        assert resp.status_code == 404

    async def test_get_bom_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/bom/1")
        assert resp.status_code == 401

    async def test_get_bom_invalid_id_returns_422(self, admin_client):
        resp = await admin_client.get("/api/v1/manufacturing/bom/abc")
        assert resp.status_code == 422


class TestGetBOMsForLine:
    """GET /api/v1/manufacturing/bom/for-line/{line_id}"""

    @patch("app.api.routes.manufacturing.BOMService.get_active_for_line", new_callable=AsyncMock)
    async def test_get_boms_for_line_success(self, mock_get, admin_client):
        mock_get.return_value = [_fake_bom()]
        resp = await admin_client.get("/api/v1/manufacturing/bom/for-line/1")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("app.api.routes.manufacturing.BOMService.get_active_for_line", new_callable=AsyncMock)
    async def test_get_boms_for_line_empty(self, mock_get, admin_client):
        mock_get.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/bom/for-line/99")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_get_boms_for_line_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/bom/for-line/1")
        assert resp.status_code == 401


class TestApproveBOM:
    """PATCH /api/v1/manufacturing/bom/{bom_id}/approve"""

    @patch("app.api.routes.manufacturing.BOMService.approve", new_callable=AsyncMock)
    async def test_approve_bom_success(self, mock_approve, admin_client):
        approved_bom = _fake_bom(approved_by_id=1, approved_at=datetime.now(timezone.utc))
        mock_approve.return_value = approved_bom
        resp = await admin_client.patch("/api/v1/manufacturing/bom/1/approve")
        assert resp.status_code == 200
        assert resp.json()["approved_by_id"] == 1

    @patch("app.api.routes.manufacturing.BOMService.approve", new_callable=AsyncMock)
    async def test_approve_bom_not_found(self, mock_approve, admin_client):
        mock_approve.return_value = None
        resp = await admin_client.patch("/api/v1/manufacturing/bom/999/approve")
        assert resp.status_code == 404

    async def test_approve_bom_no_auth(self, anon_client):
        resp = await anon_client.patch("/api/v1/manufacturing/bom/1/approve")
        assert resp.status_code == 401


class TestDownloadBOMTemplate:
    """GET /api/v1/manufacturing/bom/template/download"""

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_download_bom_template_success(self, mock_products, admin_client, mock_db):
        mock_products.return_value = []
        # Mock the db.execute for ProductionLine query
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=result)

        resp = await admin_client.get("/api/v1/manufacturing/bom/template/download")
        assert resp.status_code == 200
        assert "spreadsheetml" in resp.headers.get("content-type", "")
        assert "bom_template.xlsx" in resp.headers.get("content-disposition", "")

    async def test_download_bom_template_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/bom/template/download")
        assert resp.status_code == 401


class TestImportBOMExcel:
    """POST /api/v1/manufacturing/bom/import"""

    async def test_import_bom_non_excel_returns_400(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/bom/import",
            files={"file": ("bom.csv", b"data", "text/csv")},
        )
        assert resp.status_code == 400

    async def test_import_bom_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/bom/import",
            files={"file": ("bom.xlsx", b"fake", "application/octet-stream")},
        )
        assert resp.status_code == 401

    @patch("app.api.routes.manufacturing.BOMService.list_all", new_callable=AsyncMock)
    @patch("app.api.routes.manufacturing.BOMService.create", new_callable=AsyncMock)
    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_import_bom_success(self, mock_prod_list, mock_bom_create, mock_bom_list, admin_client, mock_db):
        # Setup: one product and one line exist
        product = _fake_product(code="PROD-001")
        mock_prod_list.return_value = [product]

        line = MagicMock()
        line.name = "Assembly Line 1"
        line.id = 1
        line_result = MagicMock()
        line_result.scalars.return_value.all.return_value = [line]
        mock_db.execute = AsyncMock(return_value=line_result)

        mock_bom_list.return_value = []  # no existing BOMs
        mock_bom_create.return_value = _fake_bom()

        excel_bytes = _build_excel_bytes(
            [("PROD-001", "Assembly Line 1", "MAT-001", "Steel Sheet", 2.5, "kg", "no", 45)],
            headers=["product_code", "line_name", "material_code", "material_name",
                      "quantity_per_unit", "unit_of_measure", "is_critical", "ideal_cycle_time_sec"],
        )

        resp = await admin_client.post(
            "/api/v1/manufacturing/bom/import",
            files={"file": ("bom.xlsx", excel_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "boms_created" in body
        assert "errors" in body


# ═══════════════════════════════════════════════════════════════════════════
# Production Orders
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateProductionOrder:
    """POST /api/v1/manufacturing/orders"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.create", new_callable=AsyncMock)
    async def test_create_order_success(self, mock_create, admin_client):
        mock_create.return_value = _fake_production_order()
        resp = await admin_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "product_id": 1,
                "planned_quantity": 100,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["planned_quantity"] == 100
        assert body["order_number"] == "PO-2025-0001"

    @patch("app.api.routes.manufacturing.ProductionOrderService.create", new_callable=AsyncMock)
    async def test_create_order_all_fields(self, mock_create, admin_client):
        mock_create.return_value = _fake_production_order(customer_ref="CUST-123", notes="Urgent")
        resp = await admin_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "product_id": 1,
                "planned_quantity": 50,
                "bom_id": 1,
                "order_number": "PO-CUSTOM-001",
                "planned_start": "2025-06-01",
                "planned_end": "2025-06-02",
                "customer_ref": "CUST-123",
                "notes": "Urgent",
            },
        )
        assert resp.status_code == 200

    async def test_create_order_missing_quantity_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "product_id": 1,
            },
        )
        assert resp.status_code == 422

    async def test_create_order_missing_product_id_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "planned_quantity": 100,
            },
        )
        assert resp.status_code == 422

    async def test_create_order_missing_line_id_returns_422(self, admin_client):
        resp = await admin_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "product_id": 1,
                "planned_quantity": 100,
            },
        )
        assert resp.status_code == 422

    async def test_create_order_no_auth(self, anon_client):
        resp = await anon_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "product_id": 1,
                "planned_quantity": 100,
            },
        )
        assert resp.status_code == 401


class TestListProductionOrders:
    """GET /api/v1/manufacturing/orders"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_success(self, mock_list, admin_client):
        mock_list.return_value = [_fake_production_order()]
        resp = await admin_client.get("/api/v1/manufacturing/orders")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_empty(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/orders")
        assert resp.status_code == 200
        assert resp.json() == []

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_filter_status(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/orders?status=planned")
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_filter_line(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/orders?line_id=1")
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_filter_product(self, mock_list, admin_client):
        mock_list.return_value = []
        resp = await admin_client.get("/api/v1/manufacturing/orders?product_id=1")
        assert resp.status_code == 200

    async def test_list_orders_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/orders")
        assert resp.status_code == 401

    @patch("app.api.routes.manufacturing.ProductionOrderService.list_all", new_callable=AsyncMock)
    async def test_list_orders_viewer_can_access(self, mock_list, viewer_client):
        mock_list.return_value = []
        resp = await viewer_client.get("/api/v1/manufacturing/orders")
        assert resp.status_code == 200


class TestGetProductionOrder:
    """GET /api/v1/manufacturing/orders/{order_id}"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_get_order_success(self, mock_get, admin_client):
        mock_get.return_value = _fake_production_order()
        resp = await admin_client.get("/api/v1/manufacturing/orders/1")
        assert resp.status_code == 200
        assert resp.json()["id"] == 1

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_get_order_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.get("/api/v1/manufacturing/orders/999")
        assert resp.status_code == 404

    async def test_get_order_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/orders/1")
        assert resp.status_code == 401

    async def test_get_order_invalid_id_returns_422(self, admin_client):
        resp = await admin_client.get("/api/v1/manufacturing/orders/abc")
        assert resp.status_code == 422


class TestUpdateProductionOrder:
    """PATCH /api/v1/manufacturing/orders/{order_id}"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_update_order_success(self, mock_get, admin_client, mock_db):
        po = _fake_production_order()
        mock_get.return_value = po
        resp = await admin_client.patch(
            "/api/v1/manufacturing/orders/1",
            json={"planned_quantity": 200},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_update_order_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.patch(
            "/api/v1/manufacturing/orders/999",
            json={"planned_quantity": 200},
        )
        assert resp.status_code == 404

    async def test_update_order_no_auth(self, anon_client):
        resp = await anon_client.patch(
            "/api/v1/manufacturing/orders/1",
            json={"planned_quantity": 200},
        )
        assert resp.status_code == 401


class TestReleaseOrder:
    """POST /api/v1/manufacturing/orders/{order_id}/release"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.update_status", new_callable=AsyncMock)
    async def test_release_order_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_production_order(status="released")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/release")
        assert resp.status_code == 200
        assert resp.json()["status"] == "released"

    @patch("app.api.routes.manufacturing.ProductionOrderService.update_status", new_callable=AsyncMock)
    async def test_release_order_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.post("/api/v1/manufacturing/orders/999/release")
        assert resp.status_code == 404

    async def test_release_order_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/manufacturing/orders/1/release")
        assert resp.status_code == 401


class TestStartOrder:
    """POST /api/v1/manufacturing/orders/{order_id}/start"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.update_status", new_callable=AsyncMock)
    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_start_order_success(self, mock_get, mock_update, admin_client):
        mock_get.return_value = _fake_production_order(qc_hold=False)
        mock_update.return_value = _fake_production_order(status="in_progress")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/start")
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_start_order_not_found(self, mock_get, admin_client):
        mock_get.return_value = None
        resp = await admin_client.post("/api/v1/manufacturing/orders/999/start")
        assert resp.status_code == 404

    @patch("app.api.routes.manufacturing.ProductionOrderService.get", new_callable=AsyncMock)
    async def test_start_order_under_qc_hold_returns_409(self, mock_get, admin_client):
        mock_get.return_value = _fake_production_order(qc_hold=True, qc_hold_reason="Quality issue")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/start")
        assert resp.status_code == 409

    async def test_start_order_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/manufacturing/orders/1/start")
        assert resp.status_code == 401


class TestCloseOrder:
    """POST /api/v1/manufacturing/orders/{order_id}/close"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.update_status", new_callable=AsyncMock)
    async def test_close_order_success(self, mock_update, admin_client):
        mock_update.return_value = _fake_production_order(status="completed")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/close")
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    @patch("app.api.routes.manufacturing.ProductionOrderService.update_status", new_callable=AsyncMock)
    async def test_close_order_not_found(self, mock_update, admin_client):
        mock_update.return_value = None
        resp = await admin_client.post("/api/v1/manufacturing/orders/999/close")
        assert resp.status_code == 404

    async def test_close_order_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/manufacturing/orders/1/close")
        assert resp.status_code == 401


class TestPlaceHold:
    """POST /api/v1/manufacturing/orders/{order_id}/hold"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.place_qc_hold", new_callable=AsyncMock)
    async def test_place_hold_success(self, mock_hold, admin_client):
        mock_hold.return_value = _fake_production_order(qc_hold=True, qc_hold_reason="Manual QC hold")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/hold")
        assert resp.status_code == 200
        assert resp.json()["qc_hold"] is True

    @patch("app.api.routes.manufacturing.ProductionOrderService.place_qc_hold", new_callable=AsyncMock)
    async def test_place_hold_with_reason(self, mock_hold, admin_client):
        mock_hold.return_value = _fake_production_order(qc_hold=True, qc_hold_reason="Contamination")
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/hold?reason=Contamination")
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductionOrderService.place_qc_hold", new_callable=AsyncMock)
    async def test_place_hold_not_found(self, mock_hold, admin_client):
        mock_hold.return_value = None
        resp = await admin_client.post("/api/v1/manufacturing/orders/999/hold")
        assert resp.status_code == 404

    async def test_place_hold_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/manufacturing/orders/1/hold")
        assert resp.status_code == 401


class TestReleaseHold:
    """POST /api/v1/manufacturing/orders/{order_id}/release-hold"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.release_qc_hold", new_callable=AsyncMock)
    async def test_release_hold_success(self, mock_release, admin_client):
        mock_release.return_value = _fake_production_order(qc_hold=False, qc_hold_reason=None)
        resp = await admin_client.post("/api/v1/manufacturing/orders/1/release-hold")
        assert resp.status_code == 200
        assert resp.json()["qc_hold"] is False

    @patch("app.api.routes.manufacturing.ProductionOrderService.release_qc_hold", new_callable=AsyncMock)
    async def test_release_hold_not_found(self, mock_release, admin_client):
        mock_release.return_value = None
        resp = await admin_client.post("/api/v1/manufacturing/orders/999/release-hold")
        assert resp.status_code == 404

    async def test_release_hold_no_auth(self, anon_client):
        resp = await anon_client.post("/api/v1/manufacturing/orders/1/release-hold")
        assert resp.status_code == 401


class TestGetOrderSummary:
    """GET /api/v1/manufacturing/orders/{order_id}/summary"""

    @patch("app.api.routes.manufacturing.ProductionOrderService.get_productivity_summary", new_callable=AsyncMock)
    async def test_get_summary_success(self, mock_summary, admin_client):
        mock_summary.return_value = {
            "order_id": 1,
            "order_number": "PO-2025-0001",
            "product_name": "Widget Alpha",
            "line_name": "Assembly Line 1",
            "status": "in_progress",
            "planned_quantity": 100,
            "actual_quantity_good": 50,
            "actual_quantity_scrap": 5,
            "progress_pct": 50.0,
            "oee": None,
            "first_pass_yield": 90.9,
            "scrap_rate": 9.1,
            "planned_vs_actual_hours": None,
            "top_defects": [{"defect_type": "scratch", "quantity": 3}],
        }
        resp = await admin_client.get("/api/v1/manufacturing/orders/1/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["order_id"] == 1
        assert body["progress_pct"] == 50.0
        assert body["actual_quantity_good"] == 50

    @patch("app.api.routes.manufacturing.ProductionOrderService.get_productivity_summary", new_callable=AsyncMock)
    async def test_get_summary_not_found(self, mock_summary, admin_client):
        mock_summary.return_value = None
        resp = await admin_client.get("/api/v1/manufacturing/orders/999/summary")
        assert resp.status_code == 404

    async def test_get_summary_no_auth(self, anon_client):
        resp = await anon_client.get("/api/v1/manufacturing/orders/1/summary")
        assert resp.status_code == 401

    async def test_get_summary_invalid_id_returns_422(self, admin_client):
        resp = await admin_client.get("/api/v1/manufacturing/orders/abc/summary")
        assert resp.status_code == 422

    @patch("app.api.routes.manufacturing.ProductionOrderService.get_productivity_summary", new_callable=AsyncMock)
    async def test_get_summary_viewer_can_access(self, mock_summary, viewer_client):
        mock_summary.return_value = {
            "order_id": 1,
            "order_number": "PO-2025-0001",
            "product_name": "Widget Alpha",
            "line_name": "Assembly Line 1",
            "status": "in_progress",
            "planned_quantity": 100,
            "actual_quantity_good": 50,
            "actual_quantity_scrap": 5,
            "progress_pct": 50.0,
            "oee": None,
            "first_pass_yield": 90.9,
            "scrap_rate": 9.1,
            "planned_vs_actual_hours": None,
            "top_defects": [],
        }
        resp = await viewer_client.get("/api/v1/manufacturing/orders/1/summary")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# Operator role access tests
# ═══════════════════════════════════════════════════════════════════════════


class TestOperatorAccess:
    """Verify that operators can access manufacturing endpoints (they only require get_current_user)."""

    @patch("app.api.routes.manufacturing.ProductService.create", new_callable=AsyncMock)
    async def test_operator_can_create_product(self, mock_create, operator_client):
        mock_create.return_value = _fake_product()
        resp = await operator_client.post(
            "/api/v1/manufacturing/products",
            json={"code": "SKU-001", "name": "Widget Alpha"},
        )
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductService.list_all", new_callable=AsyncMock)
    async def test_operator_can_list_products(self, mock_list, operator_client):
        mock_list.return_value = []
        resp = await operator_client.get("/api/v1/manufacturing/products")
        assert resp.status_code == 200

    @patch("app.api.routes.manufacturing.ProductionOrderService.create", new_callable=AsyncMock)
    async def test_operator_can_create_order(self, mock_create, operator_client):
        mock_create.return_value = _fake_production_order()
        resp = await operator_client.post(
            "/api/v1/manufacturing/orders",
            json={
                "production_line_id": 1,
                "product_id": 1,
                "planned_quantity": 100,
            },
        )
        assert resp.status_code == 200
