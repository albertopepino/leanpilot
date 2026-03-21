"""
Organization & multi-site management API routes.

Provides endpoints for:
- Organization CRUD
- Site management within organizations
- User role assignments per site
- Corporate dashboard with aggregated KPIs
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_user, get_current_active_admin, log_audit
from app.core.roles import VALID_ROLES
from app.models.organization import Organization
from app.models.user_site_role import UserSiteRole
from app.models.factory import Factory, ProductionLine
from app.models.user import User
from app.models.lean import OEERecord
from app.models.qc import NonConformanceReport
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationWithSites,
    SiteCreate,
    SiteBasic,
    SiteSummary,
    CorporateDashboard,
    UserSiteRoleCreate,
    UserSiteRoleResponse,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/organizations", tags=["organizations"])

# Separate router for user-role endpoints so the URL is /users/{id}/roles (not /organizations/users/...)
user_roles_router = APIRouter(tags=["organizations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_user_org_id(user, db: AsyncSession) -> int | None:
    """Get the organization_id via explicit queries only (async-safe, no lazy-load)."""
    # Always use explicit query to avoid MissingGreenlet on lazy-loaded relationships
    result = await db.execute(
        select(UserSiteRole.organization_id)
        .where(UserSiteRole.user_id == user.id)
        .limit(1)
    )
    org_id = result.scalar_one_or_none()
    if org_id:
        return org_id
    # Fallback: look up factory's organization_id
    if user.factory_id:
        result = await db.execute(
            select(Factory.organization_id).where(Factory.id == user.factory_id)
        )
        org_id = result.scalar_one_or_none()
        if org_id:
            return org_id
    return None


async def _get_user_organization(user, db: AsyncSession) -> Organization:
    """Load the user's organization or raise 404."""
    org_id = await _get_user_org_id(user, db)
    if not org_id:
        raise HTTPException(status_code=404, detail="User is not associated with any organization")
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ---------------------------------------------------------------------------
# Organization CRUD
# ---------------------------------------------------------------------------

@router.get("/me", response_model=OrganizationWithSites)
async def get_my_organization(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's organization with its list of sites."""
    org = await _get_user_organization(user, db)

    # Load sites
    sites_result = await db.execute(
        select(Factory).where(Factory.organization_id == org.id)
    )
    sites = sites_result.scalars().all()

    return OrganizationWithSites(
        **OrganizationResponse.model_validate(org).model_dump(),
        sites=[SiteBasic.model_validate(s) for s in sites],
    )


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get organization by ID. User must belong to it."""
    user_org_id = await _get_user_org_id(user, db)
    if user_org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/{org_id}/sites", response_model=list[SiteBasic])
async def list_organization_sites(
    org_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sites for an organization."""
    user_org_id = await _get_user_org_id(user, db)
    if user_org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")
    result = await db.execute(
        select(Factory).where(Factory.organization_id == org_id)
    )
    return result.scalars().all()


@router.get("/{org_id}/dashboard", response_model=CorporateDashboard)
async def get_corporate_dashboard(
    org_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated KPIs across all sites in an organization."""
    user_org_id = await _get_user_org_id(user, db)
    if user_org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    # Load org
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Load sites
    sites_result = await db.execute(
        select(Factory).where(Factory.organization_id == org_id)
    )
    sites = sites_result.scalars().all()

    # Aggregate KPIs per site
    site_summaries = []
    total_oee_values = []
    total_open_ncrs = 0

    for site in sites:
        # Get latest OEE for this site — OEERecord links via production_line_id, not factory_id
        oee_val = None
        try:
            oee_result = await db.execute(
                select(OEERecord.oee)
                .join(ProductionLine, OEERecord.production_line_id == ProductionLine.id)
                .where(ProductionLine.factory_id == site.id)
                .order_by(OEERecord.created_at.desc())
                .limit(1)
            )
            oee_row = oee_result.scalar_one_or_none()
            if oee_row is not None:
                oee_val = float(oee_row)
                total_oee_values.append(oee_val)
        except Exception:
            pass

        # Get open NCR count
        ncr_count = 0
        try:
            ncr_result = await db.execute(
                select(func.count(NonConformanceReport.id))
                .where(
                    NonConformanceReport.factory_id == site.id,
                    NonConformanceReport.status.in_(["open", "investigating"]),
                )
            )
            ncr_count = ncr_result.scalar() or 0
            total_open_ncrs += ncr_count
        except Exception:
            pass

        site_summaries.append(SiteSummary(
            id=site.id,
            name=site.name,
            site_code=site.site_code,
            location=site.location,
            country=site.country,
            oee=oee_val,
            safety_days=None,  # TODO: compute from SafetyIncident
            open_ncrs=ncr_count,
        ))

    avg_oee = sum(total_oee_values) / len(total_oee_values) if total_oee_values else None

    return CorporateDashboard(
        organization=OrganizationResponse.model_validate(org),
        sites=site_summaries,
        total_sites=len(sites),
        avg_oee=avg_oee,
        total_open_ncrs=total_open_ncrs,
    )


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    user=Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. Admin only."""
    # Check slug uniqueness
    existing = await db.execute(
        select(Organization).where(Organization.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Organization slug already exists")

    org = Organization(**payload.model_dump())
    db.add(org)
    await db.flush()
    await log_audit(
        db, action="organization_created", resource_type="organization",
        resource_id=str(org.id), user_id=user.id,
        detail=f"Created organization '{org.name}' (slug={org.slug})",
    )
    await db.commit()

    logger.info("organization.created", org_id=org.id, slug=org.slug)
    return org


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    user=Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an organization. Admin must belong to it."""
    user_org_id = await _get_user_org_id(user, db)
    if user_org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "slug" in update_data:
        existing = await db.execute(
            select(Organization).where(
                Organization.slug == update_data["slug"],
                Organization.id != org_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Slug already taken")

    for key, value in update_data.items():
        setattr(org, key, value)

    await log_audit(
        db, action="organization_updated", resource_type="organization",
        resource_id=str(org.id), user_id=user.id,
        detail=f"Updated organization (fields: {', '.join(update_data.keys())})",
    )
    await db.flush()
    await db.commit()
    logger.info("organization.updated", org_id=org.id)
    return org


@router.post("/{org_id}/sites", response_model=SiteBasic, status_code=201)
async def add_site_to_organization(
    org_id: int,
    data: SiteCreate,
    user=Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a new factory/site to an organization. Admin must belong to it."""
    user_org_id = await _get_user_org_id(user, db)
    if user_org_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    # Verify org exists
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check site limit
    count_result = await db.execute(
        select(func.count(Factory.id)).where(Factory.organization_id == org_id)
    )
    current_count = count_result.scalar() or 0
    if current_count >= org.max_sites:
        raise HTTPException(
            status_code=409,
            detail=f"Organization has reached max sites limit ({org.max_sites})"
        )

    factory = Factory(
        name=data.name,
        site_code=data.site_code,
        location=data.location,
        country=data.country,
        organization_id=org_id,
    )
    db.add(factory)
    await db.flush()
    await log_audit(
        db, action="organization_site_added", resource_type="factory",
        resource_id=str(factory.id), user_id=user.id,
        detail=f"Added site '{data.name}' to org {org_id}",
    )
    await db.commit()

    logger.info("organization.site_added", org_id=org_id, site_id=factory.id)
    return factory


# ---------------------------------------------------------------------------
# User role assignments — mounted on separate router at /users prefix
# ---------------------------------------------------------------------------

@user_roles_router.get("/users/{user_id}/roles", response_model=list[UserSiteRoleResponse])
async def get_user_roles(
    user_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all site-role assignments for a user."""
    # Users can view their own roles; admins can view anyone in their org
    user_role_str = (current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)).lower()
    if current_user.id != user_id and user_role_str != "admin":
        raise HTTPException(status_code=403, detail="Can only view own roles")

    # Scope to admin's organization to prevent cross-org enumeration
    if current_user.id != user_id:
        admin_org_id = await _get_user_org_id(current_user, db)
        result = await db.execute(
            select(UserSiteRole).where(
                UserSiteRole.user_id == user_id,
                UserSiteRole.organization_id == admin_org_id,
            )
        )
    else:
        result = await db.execute(
            select(UserSiteRole).where(UserSiteRole.user_id == user_id)
        )
    return result.scalars().all()


@user_roles_router.post("/users/{user_id}/roles", response_model=UserSiteRoleResponse, status_code=201)
async def assign_user_role(
    user_id: int,
    payload: UserSiteRoleCreate,
    current_user=Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user at a specific site (or org-level if site_id is null). Admin must belong to the org."""
    # Verify admin belongs to target organization
    admin_org_id = await _get_user_org_id(current_user, db)
    if admin_org_id != payload.organization_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    # Validate role
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(sorted(VALID_ROLES))}"
        )

    # Validate user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate organization exists
    org_result = await db.execute(
        select(Organization).where(Organization.id == payload.organization_id)
    )
    if not org_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    # Validate site belongs to org (if site_id provided)
    if payload.site_id is not None:
        site_result = await db.execute(
            select(Factory).where(
                Factory.id == payload.site_id,
                Factory.organization_id == payload.organization_id,
            )
        )
        if not site_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Site not found in this organization")

    role_entry = UserSiteRole(
        user_id=user_id,
        **payload.model_dump(),
    )
    db.add(role_entry)
    try:
        await db.flush()
        await log_audit(
            db, action="user_role_assigned", resource_type="user_site_role",
            resource_id=str(user_id), user_id=current_user.id,
            detail=f"Assigned role '{payload.role}' to user {user_id} (site_id={payload.site_id})",
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Role assignment already exists")

    logger.info("user.role_assigned", user_id=user_id, role=payload.role, site_id=payload.site_id)
    return role_entry


@user_roles_router.delete("/users/{user_id}/roles/{role_id}", status_code=204)
async def remove_user_role(
    user_id: int,
    role_id: int,
    current_user=Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role assignment from a user. Admin must belong to the role's organization."""
    result = await db.execute(
        select(UserSiteRole).where(
            UserSiteRole.id == role_id,
            UserSiteRole.user_id == user_id,
        )
    )
    role_entry = result.scalar_one_or_none()
    if not role_entry:
        raise HTTPException(status_code=404, detail="Role assignment not found")

    # Verify admin belongs to the same organization as this role
    admin_org_id = await _get_user_org_id(current_user, db)
    if admin_org_id != role_entry.organization_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    await log_audit(
        db, action="user_role_removed", resource_type="user_site_role",
        resource_id=str(user_id), user_id=current_user.id,
        detail=f"Removed role assignment {role_id} from user {user_id}",
    )
    await db.delete(role_entry)
    await db.flush()
    await db.commit()
    logger.info("user.role_removed", user_id=user_id, role_id=role_id)
