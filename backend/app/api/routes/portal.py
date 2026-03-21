"""
Superadmin client management portal API routes.

Provides endpoints for:
- Listing all client organizations
- Creating new clients (org + site + admin user in one transaction)
- Toggling client active status
- Viewing client health/activity metrics
- GDPR Art. 20 data portability export
- GDPR Art. 17 data erasure
"""

import structlog
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, func, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import (
    get_current_superadmin,
    get_password_hash,
    log_audit,
    get_client_ip,
)
from app.models.organization import Organization
from app.models.factory import Factory
from app.models.user import User, UserRole
from app.models.user_site_role import UserSiteRole
from app.schemas.portal import (
    ClientCreate,
    ClientSummary,
    ClientDetail,
    ClientSite,
    ClientUser,
    ClientHealth,
    ClientToggleRequest,
    GDPRExportResponse,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/portal", tags=["portal"])


# ---------------------------------------------------------------------------
# List clients
# ---------------------------------------------------------------------------

@router.get("/clients", response_model=list[ClientSummary])
async def list_clients(
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """List all client organizations with summary counts."""
    result = await db.execute(
        select(Organization).order_by(Organization.created_at.desc())
    )
    orgs = result.scalars().all()

    summaries = []
    for org in orgs:
        # Count sites
        site_count_result = await db.execute(
            select(func.count(Factory.id)).where(Factory.organization_id == org.id)
        )
        site_count = site_count_result.scalar() or 0

        # Count users across all sites in this org
        site_ids_result = await db.execute(
            select(Factory.id).where(Factory.organization_id == org.id)
        )
        site_ids = [r[0] for r in site_ids_result.all()]
        user_count = 0
        if site_ids:
            user_count_result = await db.execute(
                select(func.count(func.distinct(User.id))).where(
                    User.factory_id.in_(site_ids),
                    User.is_deleted == False,
                )
            )
            user_count = user_count_result.scalar() or 0

        summaries.append(ClientSummary(
            id=org.id,
            name=org.name,
            slug=org.slug,
            logo_url=org.logo_url,
            subscription_tier=org.subscription_tier,
            max_sites=org.max_sites,
            max_users=org.max_users,
            is_active=org.is_active,
            created_at=org.created_at,
            site_count=site_count,
            user_count=user_count,
        ))

    await log_audit(
        db, action="portal_list_clients", resource_type="portal",
        user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        legal_basis="Art. 6(1)(f) legitimate interest — platform administration",
    )
    await db.commit()
    return summaries


# ---------------------------------------------------------------------------
# Get client detail
# ---------------------------------------------------------------------------

@router.get("/clients/{org_id}", response_model=ClientDetail)
async def get_client_detail(
    org_id: int,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Get full client detail including sites and users."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Sites
    sites_result = await db.execute(
        select(Factory).where(Factory.organization_id == org_id)
    )
    sites = sites_result.scalars().all()
    site_ids = [s.id for s in sites]

    # Users
    users = []
    if site_ids:
        users_result = await db.execute(
            select(User).where(
                User.factory_id.in_(site_ids),
                User.is_deleted == False,
            ).order_by(User.full_name)
        )
        users = users_result.scalars().all()

    await log_audit(
        db, action="portal_view_client", resource_type="portal",
        resource_id=org_id, user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        legal_basis="Art. 6(1)(f) legitimate interest — platform administration",
    )
    await db.commit()

    return ClientDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        subscription_tier=org.subscription_tier,
        max_sites=org.max_sites,
        max_users=org.max_users,
        is_active=org.is_active,
        created_at=org.created_at,
        updated_at=org.updated_at,
        sites=[ClientSite.model_validate(s) for s in sites],
        users=[ClientUser(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            is_active=u.is_active,
            last_login_at=u.last_login_at,
        ) for u in users],
    )


# ---------------------------------------------------------------------------
# Create client (composite: org + site + admin user)
# ---------------------------------------------------------------------------

@router.post("/clients", response_model=ClientDetail, status_code=201)
async def create_client(
    payload: ClientCreate,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new client organization with first site and admin user."""
    # 1. Create organization
    org = Organization(
        name=payload.organization_name,
        slug=payload.slug,
        subscription_tier=payload.subscription_tier,
        max_sites=payload.max_sites,
        max_users=payload.max_users,
    )
    db.add(org)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Organization slug already exists")

    # 2. Create first site (factory)
    site = Factory(
        name=payload.site_name,
        location=payload.site_location,
        country=payload.site_country,
        organization_id=org.id,
    )
    db.add(site)
    await db.flush()

    # 3. Create admin user
    hashed_pw = get_password_hash(payload.admin_password)
    admin_user = User(
        email=payload.admin_email,
        hashed_password=hashed_pw,
        full_name=payload.admin_full_name,
        role=UserRole.ADMIN,
        factory_id=site.id,
        language=payload.admin_language,
        is_active=True,
    )
    db.add(admin_user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Admin email already exists")

    # 4. Create site role for admin
    site_role = UserSiteRole(
        user_id=admin_user.id,
        site_id=site.id,
        organization_id=org.id,
        role="admin",
        is_primary=True,
    )
    db.add(site_role)

    await log_audit(
        db, action="portal_create_client", resource_type="portal",
        resource_id=org.id, user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        detail=f"Created org '{org.name}' with site '{site.name}' and admin '{admin_user.email}'",
        legal_basis="Art. 6(1)(b) contract performance — client onboarding",
    )
    await db.commit()

    return ClientDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        subscription_tier=org.subscription_tier,
        max_sites=org.max_sites,
        max_users=org.max_users,
        is_active=org.is_active,
        created_at=org.created_at,
        updated_at=org.updated_at,
        sites=[ClientSite.model_validate(site)],
        users=[ClientUser(
            id=admin_user.id,
            email=admin_user.email,
            full_name=admin_user.full_name,
            role="admin",
            is_active=True,
            last_login_at=None,
        )],
    )


# ---------------------------------------------------------------------------
# Toggle client active status
# ---------------------------------------------------------------------------

@router.patch("/clients/{org_id}/status", response_model=ClientSummary)
async def toggle_client_status(
    org_id: int,
    payload: ClientToggleRequest,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a client organization."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.is_active = payload.is_active
    await log_audit(
        db, action="portal_toggle_client", resource_type="portal",
        resource_id=org_id, user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        detail=f"Set org '{org.name}' is_active={payload.is_active}",
        legal_basis="Art. 6(1)(f) legitimate interest — platform administration",
    )
    await db.commit()

    return ClientSummary(
        id=org.id,
        name=org.name,
        slug=org.slug,
        logo_url=org.logo_url,
        subscription_tier=org.subscription_tier,
        max_sites=org.max_sites,
        max_users=org.max_users,
        is_active=org.is_active,
        created_at=org.created_at,
        site_count=0,
        user_count=0,
    )


# ---------------------------------------------------------------------------
# Client health metrics
# ---------------------------------------------------------------------------

@router.get("/clients/{org_id}/health", response_model=ClientHealth)
async def get_client_health(
    org_id: int,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Get health/activity metrics for a client organization."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Site IDs
    site_ids_result = await db.execute(
        select(Factory.id).where(Factory.organization_id == org_id)
    )
    site_ids = [r[0] for r in site_ids_result.all()]
    total_sites = len(site_ids)

    total_users = 0
    active_users_30d = 0
    if site_ids:
        # Total users
        total_users_result = await db.execute(
            select(func.count(User.id)).where(
                User.factory_id.in_(site_ids),
                User.is_deleted == False,
            )
        )
        total_users = total_users_result.scalar() or 0

        # Active in last 30 days
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        active_result = await db.execute(
            select(func.count(User.id)).where(
                User.factory_id.in_(site_ids),
                User.is_deleted == False,
                User.last_login_at >= cutoff,
            )
        )
        active_users_30d = active_result.scalar() or 0

    # Latest OEE (optional — may not have OEE records)
    latest_oee = None
    open_kaizen = 0
    open_ncrs = 0
    try:
        from app.models.lean import OEERecord, KaizenItem
        from app.models.qc import NonConformanceReport

        if site_ids:
            oee_result = await db.execute(
                select(OEERecord.oee)
                .where(OEERecord.factory_id.in_(site_ids))
                .order_by(OEERecord.created_at.desc())
                .limit(1)
            )
            latest_oee = oee_result.scalar_one_or_none()

            kaizen_result = await db.execute(
                select(func.count(KaizenItem.id)).where(
                    KaizenItem.factory_id.in_(site_ids),
                    KaizenItem.status.in_(["open", "in_progress"]),
                )
            )
            open_kaizen = kaizen_result.scalar() or 0

            ncr_result = await db.execute(
                select(func.count(NonConformanceReport.id)).where(
                    NonConformanceReport.factory_id.in_(site_ids),
                    NonConformanceReport.status != "closed",
                )
            )
            open_ncrs = ncr_result.scalar() or 0
    except Exception:
        pass  # Models may not exist yet

    return ClientHealth(
        org_id=org.id,
        org_name=org.name,
        total_users=total_users,
        active_users_30d=active_users_30d,
        total_sites=total_sites,
        latest_oee=latest_oee,
        open_kaizen=open_kaizen,
        open_ncrs=open_ncrs,
    )


# ---------------------------------------------------------------------------
# GDPR Art. 20 — Data portability export
# ---------------------------------------------------------------------------

@router.get("/clients/{org_id}/gdpr-export", response_model=GDPRExportResponse)
async def gdpr_export_client(
    org_id: int,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Export all personal data for a client organization (GDPR Art. 20)."""
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Collect users
    site_ids_result = await db.execute(
        select(Factory.id).where(Factory.organization_id == org_id)
    )
    site_ids = [r[0] for r in site_ids_result.all()]

    users_data = []
    if site_ids:
        users_result = await db.execute(
            select(User).where(User.factory_id.in_(site_ids))
        )
        for u in users_result.scalars().all():
            users_data.append({
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "language": u.language,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "privacy_policy_accepted_at": u.privacy_policy_accepted_at.isoformat() if u.privacy_policy_accepted_at else None,
                "consent_version": u.consent_version,
                "ai_consent": u.ai_consent,
                "marketing_consent": u.marketing_consent,
            })

    # Sites data
    sites_data = []
    if site_ids:
        sites_result = await db.execute(
            select(Factory).where(Factory.id.in_(site_ids))
        )
        for s in sites_result.scalars().all():
            sites_data.append({
                "id": s.id,
                "name": s.name,
                "location": s.location,
                "country": s.country,
            })

    await log_audit(
        db, action="portal_gdpr_export", resource_type="portal",
        resource_id=org_id, user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        detail=f"GDPR data export for org '{org.name}'",
        legal_basis="Art. 20 — Right to data portability",
    )
    await db.commit()

    return GDPRExportResponse(
        org_id=org.id,
        org_name=org.name,
        export_date=datetime.now(timezone.utc).isoformat(),
        data={
            "organization": {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "subscription_tier": org.subscription_tier,
                "created_at": org.created_at.isoformat() if org.created_at else None,
            },
            "sites": sites_data,
            "users": users_data,
        },
    )


# ---------------------------------------------------------------------------
# GDPR Art. 17 — Right to erasure
# ---------------------------------------------------------------------------

@router.delete("/clients/{org_id}/gdpr-erase", status_code=200)
async def gdpr_erase_client(
    org_id: int,
    request: Request,
    user=Depends(get_current_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete all personal data for a client organization (GDPR Art. 17).

    This anonymizes user data but preserves aggregate operational records.
    """
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    site_ids_result = await db.execute(
        select(Factory.id).where(Factory.organization_id == org_id)
    )
    site_ids = [r[0] for r in site_ids_result.all()]

    erased_count = 0
    if site_ids:
        users_result = await db.execute(
            select(User).where(
                User.factory_id.in_(site_ids),
                User.is_deleted == False,
            )
        )
        now = datetime.now(timezone.utc)
        for u in users_result.scalars().all():
            u.is_deleted = True
            u.deleted_at = now
            u.deletion_requested_at = now
            u.email = f"erased_{u.id}@deleted.local"
            u.full_name = "Erased User"
            u.hashed_password = "ERASED"
            u.is_active = False
            u.totp_secret = None
            u.last_login_ip = None
            u.last_user_agent = None
            u.reset_token = None
            erased_count += 1

    # Deactivate the organization
    org.is_active = False

    await log_audit(
        db, action="portal_gdpr_erase", resource_type="portal",
        resource_id=org_id, user_id=user.id, user_email=user.email,
        ip_address=get_client_ip(request),
        detail=f"GDPR erasure for org '{org.name}': {erased_count} users anonymized",
        legal_basis="Art. 17 — Right to erasure",
    )
    await db.commit()

    return {
        "status": "erased",
        "org_id": org_id,
        "users_erased": erased_count,
        "message": f"All personal data for '{org.name}' has been anonymized. Organization deactivated.",
    }
