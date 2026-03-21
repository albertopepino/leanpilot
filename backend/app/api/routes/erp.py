"""
ERP Integration API routes.

Admin-only CRUD for ERP configurations, connection testing, and manual sync.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.security import get_current_active_admin, require_factory, log_audit
from app.core.encryption import encrypt_field
from app.models.user import User
from app.models.erp import ERPIntegration
from app.services.erp_service import get_connector, run_erp_sync

router = APIRouter(prefix="/erp", tags=["erp"])

VALID_ERP_TYPES = {"navision", "sap", "oracle"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ERPCreateUpdate(BaseModel):
    erp_type: str
    display_name: str | None = None
    is_active: bool = False
    host: str | None = None
    port: int | None = None
    database_name: str | None = None
    username: str | None = None
    password: str | None = None
    api_key: str | None = None
    sap_client: str | None = None
    sap_system_number: str | None = None
    oracle_service_name: str | None = None
    sync_products: bool = True
    sync_production_orders: bool = True
    sync_inventory: bool = False
    sync_interval_minutes: int = 60


class ERPResponse(BaseModel):
    id: int
    erp_type: str
    display_name: str | None
    is_active: bool
    host: str | None
    port: int | None
    database_name: str | None
    username: str | None
    has_password: bool
    has_api_key: bool
    sap_client: str | None
    sap_system_number: str | None
    oracle_service_name: str | None
    sync_products: bool | None
    sync_production_orders: bool | None
    sync_inventory: bool | None
    sync_interval_minutes: int | None
    last_sync_at: str | None
    last_sync_status: str | None
    last_sync_message: str | None


def _to_response(e: ERPIntegration) -> dict:
    return {
        "id": e.id,
        "erp_type": e.erp_type,
        "display_name": e.display_name,
        "is_active": e.is_active,
        "host": e.host,
        "port": e.port,
        "database_name": e.database_name,
        "username": e.username,
        "has_password": bool(e.password_encrypted),
        "has_api_key": bool(e.api_key_encrypted),
        "sap_client": e.sap_client,
        "sap_system_number": e.sap_system_number,
        "oracle_service_name": e.oracle_service_name,
        "sync_products": e.sync_products,
        "sync_production_orders": e.sync_production_orders,
        "sync_inventory": e.sync_inventory,
        "sync_interval_minutes": e.sync_interval_minutes,
        "last_sync_at": e.last_sync_at.isoformat() if e.last_sync_at else None,
        "last_sync_status": e.last_sync_status,
        "last_sync_message": e.last_sync_message,
    }


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("/integrations")
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """List all ERP integrations for this factory."""
    fid = require_factory(admin)
    result = await db.execute(
        select(ERPIntegration).where(ERPIntegration.factory_id == fid)
    )
    return [_to_response(e) for e in result.scalars().all()]


@router.post("/integrations")
async def create_integration(
    payload: ERPCreateUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Create a new ERP integration."""
    fid = require_factory(admin)

    if payload.erp_type not in VALID_ERP_TYPES:
        raise HTTPException(400, f"Invalid ERP type. Supported: {', '.join(VALID_ERP_TYPES)}")

    integration = ERPIntegration(
        factory_id=fid,
        erp_type=payload.erp_type,
        display_name=payload.display_name or payload.erp_type.upper(),
        is_active=payload.is_active,
        host=payload.host,
        port=payload.port,
        database_name=payload.database_name,
        username=payload.username,
        password_encrypted=encrypt_field(payload.password) if payload.password else None,
        api_key_encrypted=encrypt_field(payload.api_key) if payload.api_key else None,
        sap_client=payload.sap_client,
        sap_system_number=payload.sap_system_number,
        oracle_service_name=payload.oracle_service_name,
        sync_products=payload.sync_products,
        sync_production_orders=payload.sync_production_orders,
        sync_inventory=payload.sync_inventory,
        sync_interval_minutes=payload.sync_interval_minutes,
    )
    db.add(integration)

    await log_audit(
        db, action="erp_integration_created", resource_type="erp",
        resource_id="new", user_id=admin.id,
        detail=f"Created {payload.erp_type} integration",
    )
    await db.commit()
    await db.refresh(integration)

    return _to_response(integration)


@router.put("/integrations/{integration_id}")
async def update_integration(
    integration_id: int,
    payload: ERPCreateUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update an existing ERP integration."""
    fid = require_factory(admin)

    result = await db.execute(
        select(ERPIntegration).where(
            ERPIntegration.id == integration_id,
            ERPIntegration.factory_id == fid,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    integration.erp_type = payload.erp_type
    integration.display_name = payload.display_name
    integration.is_active = payload.is_active
    integration.host = payload.host
    integration.port = payload.port
    integration.database_name = payload.database_name
    integration.username = payload.username
    if payload.password:
        integration.password_encrypted = encrypt_field(payload.password)
    if payload.api_key:
        integration.api_key_encrypted = encrypt_field(payload.api_key)
    integration.sap_client = payload.sap_client
    integration.sap_system_number = payload.sap_system_number
    integration.oracle_service_name = payload.oracle_service_name
    integration.sync_products = payload.sync_products
    integration.sync_production_orders = payload.sync_production_orders
    integration.sync_inventory = payload.sync_inventory
    integration.sync_interval_minutes = payload.sync_interval_minutes

    await log_audit(
        db, action="erp_integration_updated", resource_type="erp",
        resource_id=str(integration_id), user_id=admin.id,
        detail=f"Updated {payload.erp_type} integration",
    )
    await db.commit()

    return _to_response(integration)


@router.delete("/integrations/{integration_id}")
async def delete_integration(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Delete an ERP integration."""
    fid = require_factory(admin)

    result = await db.execute(
        select(ERPIntegration).where(
            ERPIntegration.id == integration_id,
            ERPIntegration.factory_id == fid,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    await db.delete(integration)
    await log_audit(
        db, action="erp_integration_deleted", resource_type="erp",
        resource_id=str(integration_id), user_id=admin.id,
        detail=f"Deleted {integration.erp_type} integration",
    )
    await db.commit()

    return {"ok": True}


# ---------------------------------------------------------------------------
# Test connection & sync
# ---------------------------------------------------------------------------


@router.post("/integrations/{integration_id}/test")
async def test_connection(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Test ERP connection."""
    fid = require_factory(admin)

    result = await db.execute(
        select(ERPIntegration).where(
            ERPIntegration.id == integration_id,
            ERPIntegration.factory_id == fid,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    connector = get_connector(integration)
    test_result = await connector.test_connection()

    return test_result


@router.post("/integrations/{integration_id}/sync")
async def trigger_sync(
    integration_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Manually trigger ERP data sync."""
    fid = require_factory(admin)

    result = await db.execute(
        select(ERPIntegration).where(
            ERPIntegration.id == integration_id,
            ERPIntegration.factory_id == fid,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(404, "Integration not found")

    if not integration.is_active:
        raise HTTPException(400, "Integration is not active. Enable it first.")

    sync_result = await run_erp_sync(db, integration_id)

    await log_audit(
        db, action="erp_sync_triggered", resource_type="erp",
        resource_id=str(integration_id), user_id=admin.id,
        detail=f"Manual sync: {sync_result.get('summary', sync_result.get('error', 'unknown'))}",
    )

    return sync_result
