"""
ERP Integration Service for LeanPilot.

Provides a generic connector framework with adapters for:
- Microsoft Dynamics 365 Business Central (Navision)
- SAP S/4HANA / SAP Business One (via OData/RFC)
- Oracle E-Business Suite / Oracle Cloud ERP

Connection testing and data sync operations are designed to run
asynchronously without blocking the FastAPI event loop.
"""
import asyncio
import structlog
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.erp import ERPIntegration

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Base connector interface
# ---------------------------------------------------------------------------


class ERPConnector(ABC):
    """Abstract base for ERP connectors."""

    def __init__(self, config: ERPIntegration):
        self.config = config

    @abstractmethod
    async def test_connection(self) -> dict:
        """Test connectivity. Returns {"success": bool, "message": str, "details": dict}."""
        ...

    @abstractmethod
    async def sync_products(self) -> dict:
        """Pull product/item master data. Returns {"count": int, "errors": list}."""
        ...

    @abstractmethod
    async def sync_production_orders(self) -> dict:
        """Pull production/manufacturing orders. Returns {"count": int, "errors": list}."""
        ...

    @abstractmethod
    async def sync_inventory(self) -> dict:
        """Pull inventory/stock levels. Returns {"count": int, "errors": list}."""
        ...


# ---------------------------------------------------------------------------
# Navision (Dynamics 365 Business Central) connector
# ---------------------------------------------------------------------------


class NavisionConnector(ERPConnector):
    """
    Connects to Microsoft Dynamics 365 Business Central via OData v4 API.

    Requires:
    - host: e.g. "https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}"
    - username: BC user email
    - api_key_encrypted: Web service access key or OAuth token
    """

    async def test_connection(self) -> dict:
        try:
            # Test via OData $metadata endpoint
            url = f"{self.config.host}/api/v2.0/companies"
            result = await _http_get(url, auth=(self.config.username, _decrypt(self.config.api_key_encrypted)))
            companies = result.get("value", [])
            return {
                "success": True,
                "message": f"Connected. Found {len(companies)} company(ies).",
                "details": {"companies": [c.get("displayName", c.get("name", "")) for c in companies[:5]]},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "details": {}}

    async def sync_products(self) -> dict:
        url = f"{self.config.host}/api/v2.0/items"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.api_key_encrypted)))
        items = data.get("value", [])
        return {"count": len(items), "errors": [], "sample": items[:3]}

    async def sync_production_orders(self) -> dict:
        url = f"{self.config.host}/api/v2.0/productionOrders"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.api_key_encrypted)))
        orders = data.get("value", [])
        return {"count": len(orders), "errors": [], "sample": orders[:3]}

    async def sync_inventory(self) -> dict:
        url = f"{self.config.host}/api/v2.0/itemLedgerEntries"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.api_key_encrypted)))
        entries = data.get("value", [])
        return {"count": len(entries), "errors": []}


# ---------------------------------------------------------------------------
# SAP connector
# ---------------------------------------------------------------------------


class SAPConnector(ERPConnector):
    """
    Connects to SAP S/4HANA or SAP Business One via OData API.

    Requires:
    - host: SAP server URL (e.g. "https://saphost:50000")
    - sap_client: SAP client number (e.g. "100")
    - username / password_encrypted: SAP user credentials
    """

    async def test_connection(self) -> dict:
        try:
            url = f"{self.config.host}/sap/opu/odata/sap/API_PRODUCT_SRV/$metadata"
            headers = {"sap-client": self.config.sap_client or "100"}
            await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)), headers=headers)
            return {
                "success": True,
                "message": f"Connected to SAP (client {self.config.sap_client}).",
                "details": {"host": self.config.host, "client": self.config.sap_client},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "details": {}}

    async def sync_products(self) -> dict:
        url = f"{self.config.host}/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product"
        headers = {"sap-client": self.config.sap_client or "100"}
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)), headers=headers)
        results = data.get("d", {}).get("results", [])
        return {"count": len(results), "errors": [], "sample": results[:3]}

    async def sync_production_orders(self) -> dict:
        url = f"{self.config.host}/sap/opu/odata/sap/API_PRODUCTION_ORDER_SRV/A_ProductionOrder"
        headers = {"sap-client": self.config.sap_client or "100"}
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)), headers=headers)
        results = data.get("d", {}).get("results", [])
        return {"count": len(results), "errors": [], "sample": results[:3]}

    async def sync_inventory(self) -> dict:
        url = f"{self.config.host}/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctMod"
        headers = {"sap-client": self.config.sap_client or "100"}
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)), headers=headers)
        results = data.get("d", {}).get("results", [])
        return {"count": len(results), "errors": []}


# ---------------------------------------------------------------------------
# Oracle connector
# ---------------------------------------------------------------------------


class OracleConnector(ERPConnector):
    """
    Connects to Oracle ERP Cloud or Oracle E-Business Suite via REST API.

    Requires:
    - host: Oracle REST endpoint (e.g. "https://oracle-host.com/fscmRestApi/resources")
    - username / password_encrypted: Oracle user credentials
    """

    async def test_connection(self) -> dict:
        try:
            url = f"{self.config.host}/11.13.18.05/inventoryOrganizations"
            result = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)))
            items = result.get("items", [])
            return {
                "success": True,
                "message": f"Connected to Oracle ERP. Found {len(items)} organization(s).",
                "details": {"organizations": [o.get("OrganizationName", "") for o in items[:5]]},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "details": {}}

    async def sync_products(self) -> dict:
        url = f"{self.config.host}/11.13.18.05/items"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)))
        items = data.get("items", [])
        return {"count": len(items), "errors": [], "sample": items[:3]}

    async def sync_production_orders(self) -> dict:
        url = f"{self.config.host}/11.13.18.05/workOrders"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)))
        items = data.get("items", [])
        return {"count": len(items), "errors": [], "sample": items[:3]}

    async def sync_inventory(self) -> dict:
        url = f"{self.config.host}/11.13.18.05/inventoryBalances"
        data = await _http_get(url, auth=(self.config.username, _decrypt(self.config.password_encrypted)))
        items = data.get("items", [])
        return {"count": len(items), "errors": []}


# ---------------------------------------------------------------------------
# Connector factory
# ---------------------------------------------------------------------------

CONNECTORS: dict[str, type[ERPConnector]] = {
    "navision": NavisionConnector,
    "sap": SAPConnector,
    "oracle": OracleConnector,
}


def get_connector(config: ERPIntegration) -> ERPConnector:
    """Create the appropriate ERP connector based on erp_type."""
    cls = CONNECTORS.get(config.erp_type)
    if not cls:
        raise ValueError(f"Unsupported ERP type: {config.erp_type}")
    return cls(config)


# ---------------------------------------------------------------------------
# Sync orchestrator
# ---------------------------------------------------------------------------


async def run_erp_sync(session: AsyncSession, integration_id: int) -> dict:
    """Run a full sync for a given ERP integration."""
    result = await session.execute(
        select(ERPIntegration).where(ERPIntegration.id == integration_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {"error": "Integration not found"}

    config.last_sync_status = "running"
    config.last_sync_at = datetime.now(timezone.utc)
    await session.commit()

    connector = get_connector(config)
    summary = {}

    try:
        if config.sync_products:
            summary["products"] = await connector.sync_products()
        if config.sync_production_orders:
            summary["production_orders"] = await connector.sync_production_orders()
        if config.sync_inventory:
            summary["inventory"] = await connector.sync_inventory()

        config.last_sync_status = "success"
        config.last_sync_message = f"Synced: {', '.join(summary.keys())}"
        config.last_sync_at = datetime.now(timezone.utc)
        await session.commit()

        logger.info("erp_sync.success", integration_id=integration_id, summary=summary)
        return {"success": True, "summary": summary}

    except Exception as e:
        config.last_sync_status = "error"
        config.last_sync_message = str(e)[:500]
        config.last_sync_at = datetime.now(timezone.utc)
        await session.commit()

        logger.exception("erp_sync.failed", integration_id=integration_id)
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _decrypt(value: str | None) -> str:
    """Decrypt an encrypted credential value using Fernet symmetric encryption."""
    if not value:
        return ""
    from app.core.encryption import decrypt_field
    return decrypt_field(value)


async def _http_get(url: str, auth: tuple | None = None, headers: dict | None = None) -> dict:
    """Make an async HTTP GET request using httpx."""
    import httpx

    async with httpx.AsyncClient(timeout=30, verify=True) as client:
        kwargs: dict[str, Any] = {"headers": headers or {}}
        if auth:
            kwargs["auth"] = auth
        resp = await client.get(url, **kwargs)
        resp.raise_for_status()
        return resp.json()
