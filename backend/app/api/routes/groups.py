"""
Group policies routes — group CRUD, policy management, membership.
All endpoints require ADMIN role + tenant isolation.
"""
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import (
    get_current_active_admin, require_factory,
    log_audit, get_client_ip,
)
from app.models.user import User
from app.models.groups import Group, GroupPolicy, user_groups
from app.schemas.groups import (
    GroupCreate, GroupUpdate, GroupResponse, GroupPolicyItem,
    GroupPoliciesSet, GroupMemberUpdate,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/admin/groups", tags=["groups"])


def _group_to_response(group: Group) -> GroupResponse:
    """Convert a Group ORM instance (with loaded relations) to GroupResponse."""
    policies = [
        GroupPolicyItem(tab_id=p.tab_id, permission=p.permission)
        for p in (group.policies or [])
    ]
    member_ids = [u.id for u in (group.members or [])]
    return GroupResponse(
        id=group.id,
        factory_id=group.factory_id,
        name=group.name,
        description=group.description,
        color=group.color,
        is_active=group.is_active,
        policies=policies,
        member_ids=member_ids,
        member_count=len(member_ids),
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


async def _get_group(db: AsyncSession, group_id: int, factory_id: int) -> Group:
    """Fetch a group with eagerly loaded policies and members, scoped to factory."""
    result = await db.execute(
        select(Group)
        .where(Group.id == group_id, Group.factory_id == factory_id)
        .options(selectinload(Group.policies), selectinload(Group.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found in your factory")
    return group


# ---------------------------------------------------------------------------
# List / Create / Update / Delete groups
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[GroupResponse])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """List all groups in the admin's factory."""
    fid = require_factory(admin)
    result = await db.execute(
        select(Group)
        .where(Group.factory_id == fid)
        .options(selectinload(Group.policies), selectinload(Group.members))
        .order_by(Group.name)
    )
    groups = result.scalars().unique().all()
    return [_group_to_response(g) for g in groups]


@router.post("/", response_model=GroupResponse)
async def create_group(
    request: Request,
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Create a new group within the admin's factory."""
    fid = require_factory(admin)

    # Check uniqueness
    existing = await db.execute(
        select(Group).where(Group.factory_id == fid, Group.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A group with this name already exists")

    group = Group(
        factory_id=fid,
        name=data.name,
        description=data.description,
        color=data.color,
        is_active=True,
    )
    db.add(group)
    await db.flush()

    await log_audit(
        db, action="group_created", resource_type="group",
        resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Created group '{data.name}'",
    )
    await db.commit()

    # Reload with relations
    group = await _get_group(db, group.id, fid)
    return _group_to_response(group)


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    request: Request,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Update a group's name, description, color, or active status."""
    fid = require_factory(admin)
    group = await _get_group(db, group_id, fid)

    changes = []
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(group, field)
        setattr(group, field, value)
        changes.append(f"{field}: {old} → {value}")

    if changes:
        await log_audit(
            db, action="group_updated", resource_type="group",
            resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
            factory_id=fid, ip_address=get_client_ip(request),
            detail="; ".join(changes),
        )
        await db.commit()

    group = await _get_group(db, group_id, fid)
    return _group_to_response(group)


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Soft-delete (deactivate) a group."""
    fid = require_factory(admin)
    group = await _get_group(db, group_id, fid)

    group.is_active = False
    await log_audit(
        db, action="group_deleted", resource_type="group",
        resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Deactivated group '{group.name}'",
    )
    await db.commit()
    return {"status": "deactivated"}


# ---------------------------------------------------------------------------
# Policies — replace all policies for a group
# ---------------------------------------------------------------------------

@router.put("/{group_id}/policies", response_model=GroupResponse)
async def set_group_policies(
    group_id: int,
    request: Request,
    data: GroupPoliciesSet,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Replace all policies for a group."""
    fid = require_factory(admin)
    group = await _get_group(db, group_id, fid)

    # Delete existing policies
    await db.execute(
        delete(GroupPolicy).where(GroupPolicy.group_id == group.id)
    )

    # Insert new policies
    for item in data.policies:
        db.add(GroupPolicy(
            group_id=group.id,
            tab_id=item.tab_id,
            permission=item.permission,
        ))

    tab_summary = ", ".join(f"{p.tab_id}={p.permission}" for p in data.policies)
    await log_audit(
        db, action="group_policies_updated", resource_type="group",
        resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
        factory_id=fid, ip_address=get_client_ip(request),
        detail=f"Set {len(data.policies)} policies: {tab_summary}",
    )
    await db.commit()

    group = await _get_group(db, group_id, fid)
    return _group_to_response(group)


# ---------------------------------------------------------------------------
# Members — add / remove users
# ---------------------------------------------------------------------------

@router.post("/{group_id}/members", response_model=GroupResponse)
async def add_group_members(
    group_id: int,
    request: Request,
    data: GroupMemberUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Add users to a group. Users must belong to the same factory."""
    fid = require_factory(admin)
    group = await _get_group(db, group_id, fid)

    # Verify all users belong to same factory
    result = await db.execute(
        select(User).where(User.id.in_(data.user_ids), User.factory_id == fid)
    )
    valid_users = result.scalars().all()
    valid_ids = {u.id for u in valid_users}

    invalid_ids = set(data.user_ids) - valid_ids
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Users not found in your factory: {sorted(invalid_ids)}",
        )

    # Add only users not already members
    existing_ids = {u.id for u in group.members}
    added = []
    for user in valid_users:
        if user.id not in existing_ids:
            group.members.append(user)
            added.append(user.id)

    if added:
        await log_audit(
            db, action="group_members_added", resource_type="group",
            resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
            factory_id=fid, ip_address=get_client_ip(request),
            detail=f"Added {len(added)} members: {added}",
        )
        await db.commit()

    group = await _get_group(db, group_id, fid)
    return _group_to_response(group)


@router.delete("/{group_id}/members", response_model=GroupResponse)
async def remove_group_members(
    group_id: int,
    request: Request,
    data: GroupMemberUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_admin),
):
    """Remove users from a group."""
    fid = require_factory(admin)
    group = await _get_group(db, group_id, fid)

    removed = []
    group.members = [u for u in group.members if u.id not in set(data.user_ids)]
    removed = [uid for uid in data.user_ids if uid not in {u.id for u in group.members}]

    if removed:
        await log_audit(
            db, action="group_members_removed", resource_type="group",
            resource_id=str(group.id), user_id=admin.id, user_email=admin.email,
            factory_id=fid, ip_address=get_client_ip(request),
            detail=f"Removed members: {removed}",
        )
        await db.commit()

    group = await _get_group(db, group_id, fid)
    return _group_to_response(group)
