from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.schemas.lean_advanced import (
    SixSAuditCreate, SixSAuditResponse, VSMCreate, VSMResponse,
    A3ReportCreate, A3ReportResponse,
    GembaWalkCreate, GembaWalkResponse,
    TPMEquipmentCreate, TPMMaintenanceCreate,
    CILTStandardCreate, CILTExecutionCreate,
    AndonEventCreate, AndonResolve, HourlyProductionCreate,
)
from app.services.lean_advanced import (
    SixSService, VSMService, A3Service, GembaService,
    TPMService, CILTService, AndonService, HourlyProductionService,
)

router = APIRouter(prefix="/lean-advanced", tags=["lean-advanced"])


# ---- 6S AUDIT ----

@router.post("/six-s")
async def create_six_s_audit(
    data: SixSAuditCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    audit = await SixSService.create_audit(db, fid, user.id, data.model_dump())
    return {"id": audit.id, "overall_score": audit.overall_score, "maturity_level": audit.maturity_level}


@router.get("/six-s", response_model=list[SixSAuditResponse])
async def list_six_s_audits(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SixSService.list_audits(db, fid)


@router.get("/six-s/trend")
async def six_s_trend(
    area: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await SixSService.get_trend(db, fid, area)


# ---- VSM ----

@router.post("/vsm")
async def create_vsm(
    data: VSMCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    vsm = await VSMService.create(db, fid, user.id, data.model_dump())
    return {"id": vsm.id, "pce_ratio": vsm.pce_ratio, "total_lead_time_days": vsm.total_lead_time_days}


@router.get("/vsm", response_model=list[VSMResponse])
async def list_vsm(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await VSMService.list_maps(db, fid)


# ---- A3 REPORT ----

@router.post("/a3")
async def create_a3(
    data: A3ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    report = await A3Service.create(db, fid, user.id, data.model_dump())
    return {"id": report.id, "status": str(report.status).lower() if report.status else report.status}


@router.get("/a3", response_model=list[A3ReportResponse])
async def list_a3(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await A3Service.list_reports(db, fid)


@router.patch("/a3/{report_id}/status", response_model=A3ReportResponse)
async def update_a3_status(
    report_id: int,
    status: str,
    results: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await A3Service.update_status(db, report_id, status, results, factory_id=fid)


# ---- GEMBA WALK ----

@router.post("/gemba")
async def create_gemba_walk(
    data: GembaWalkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    walk = await GembaService.create_walk(db, fid, user.id, data.model_dump())
    return {"id": walk.id}


@router.get("/gemba", response_model=list[GembaWalkResponse])
async def list_gemba_walks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await GembaService.list_walks(db, fid)


# ---- TPM ----

@router.post("/tpm/equipment")
async def create_tpm_equipment(
    data: TPMEquipmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    eq = await TPMService.create_equipment(db, fid, data.model_dump())
    return {"id": eq.id, "name": eq.name}


@router.get("/tpm/equipment")
async def list_tpm_equipment(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await TPMService.list_equipment(db, fid)


@router.post("/tpm/maintenance")
async def log_tpm_maintenance(
    data: TPMMaintenanceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await TPMService.log_maintenance(db, user.id, data.model_dump(), factory_id=fid)
    return {"id": record.id}


@router.get("/tpm/equipment/{equipment_id}/metrics")
async def get_equipment_metrics(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Calculate MTBF and MTTR for equipment from maintenance records."""
    from sqlalchemy import select, func, and_
    from app.models.lean_advanced import TPMEquipment, TPMMaintenanceRecord

    fid = require_factory(user)

    # Get equipment
    eq_q = select(TPMEquipment).where(
        TPMEquipment.id == equipment_id,
        TPMEquipment.factory_id == fid,
    )
    eq_r = await db.execute(eq_q)
    equipment = eq_r.scalar_one_or_none()
    if not equipment:
        raise HTTPException(404, "Equipment not found")

    # Get corrective maintenance records (breakdowns)
    maint_q = select(TPMMaintenanceRecord).where(
        and_(
            TPMMaintenanceRecord.equipment_id == equipment_id,
            TPMMaintenanceRecord.maintenance_type == "corrective",
        )
    ).order_by(TPMMaintenanceRecord.date_performed)
    maint_r = await db.execute(maint_q)
    breakdowns = maint_r.scalars().all()

    # Calculate MTBF (mean time between failures)
    mtbf_hours = None
    if len(breakdowns) >= 2:
        total_hours = 0
        for i in range(1, len(breakdowns)):
            delta = breakdowns[i].date_performed - breakdowns[i - 1].date_performed
            total_hours += delta.total_seconds() / 3600
        mtbf_hours = round(total_hours / (len(breakdowns) - 1), 1)

    # Calculate MTTR (mean time to repair)
    mttr_hours = None
    repair_times = [b.duration_min for b in breakdowns if b.duration_min]
    if repair_times:
        mttr_hours = round(sum(repair_times) / len(repair_times) / 60, 1)

    # Update equipment record with calculated values
    if mtbf_hours is not None:
        equipment.mtbf_hours = mtbf_hours
    if mttr_hours is not None:
        equipment.mttr_hours = mttr_hours
    await db.commit()

    return {
        "equipment_id": equipment_id,
        "equipment_name": equipment.name,
        "mtbf_hours": mtbf_hours,
        "mttr_hours": mttr_hours,
        "total_breakdowns": len(breakdowns),
        "availability_pct": round(mtbf_hours / (mtbf_hours + mttr_hours) * 100, 1) if mtbf_hours and mttr_hours else None,
    }


# ---- CILT ----

@router.post("/cilt/standards")
async def create_cilt_standard(
    data: CILTStandardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    standard = await CILTService.create_standard(db, fid, data.model_dump())
    return {"id": standard.id, "name": standard.name}


@router.get("/cilt/standards")
async def list_cilt_standards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await CILTService.list_standards(db, fid)


@router.post("/cilt/execute")
async def execute_cilt(
    data: CILTExecutionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    execution = await CILTService.execute_cilt(db, user.id, data.model_dump(), factory_id=fid)
    return {"id": execution.id, "all_ok": execution.all_ok}


@router.get("/cilt/compliance")
async def cilt_compliance(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await CILTService.get_compliance_rate(db, fid)


# ---- ANDON ----

@router.post("/andon")
async def create_andon_event(
    data: AndonEventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    event = await AndonService.create_event(db, fid, user.id, data.model_dump())
    return {"id": event.id, "status": str(event.status).lower() if event.status else event.status}


@router.post("/andon/{event_id}/resolve")
async def resolve_andon(
    event_id: int,
    data: AndonResolve | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    notes = data.resolution_notes if data else None
    event = await AndonService.resolve_event(db, event_id, resolution_notes=notes, factory_id=fid)
    return {"id": event.id, "resolution_time_min": event.resolution_time_min}


@router.get("/andon/status")
async def andon_current_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    return await AndonService.get_current_status(db, fid)


# ---- HOURLY PRODUCTION ----

@router.post("/hourly")
async def log_hourly_production(
    data: HourlyProductionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    record = await HourlyProductionService.log_hour(db, data.model_dump(), factory_id=fid)
    return {"id": record.id, "is_win": record.is_win}


@router.get("/hourly/{line_id}")
async def get_hourly_view(
    line_id: int,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    fid = require_factory(user)
    dt = datetime.fromisoformat(date)
    return await HourlyProductionService.get_day_view(db, line_id, dt, factory_id=fid)


# ---- MIND MAP ----

from pydantic import BaseModel as PydanticBaseModel


class MindMapCreate(PydanticBaseModel):
    title: str = ""
    description: str = ""
    nodes: list = []
    connectors: list = []


class MindMapUpdate(PydanticBaseModel):
    title: str | None = None
    description: str | None = None
    nodes: list | None = None
    connectors: list | None = None


@router.post("/mindmap")
async def create_mind_map(
    data: MindMapCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    mind_map = MindMap(
        factory_id=fid,
        created_by_id=user.id,
        title=data.title,
        description=data.description,
        nodes=data.nodes,
        connectors=data.connectors,
    )
    db.add(mind_map)
    await db.flush()
    await db.commit()
    return {"id": mind_map.id, "title": mind_map.title}


@router.get("/mindmap")
async def list_mind_maps(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap)
        .where(MindMap.factory_id == fid)
        .order_by(MindMap.created_at.desc())
    )
    maps = result.scalars().all()
    return [
        {
            "id": m.id,
            "title": m.title,
            "description": m.description,
            "nodes": m.nodes,
            "connectors": m.connectors,
            "created_at": m.created_at.isoformat() if m.created_at else "",
            "updated_at": m.updated_at.isoformat() if m.updated_at else "",
        }
        for m in maps
    ]


@router.get("/mindmap/{map_id}")
async def get_mind_map(
    map_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    return {
        "id": mind_map.id,
        "title": mind_map.title,
        "description": mind_map.description,
        "nodes": mind_map.nodes,
        "connectors": mind_map.connectors,
        "created_at": mind_map.created_at.isoformat() if mind_map.created_at else "",
        "updated_at": mind_map.updated_at.isoformat() if mind_map.updated_at else "",
    }


@router.patch("/mindmap/{map_id}")
async def update_mind_map(
    map_id: int,
    data: MindMapUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    if data.title is not None:
        mind_map.title = data.title
    if data.description is not None:
        mind_map.description = data.description
    if data.nodes is not None:
        mind_map.nodes = data.nodes
    if data.connectors is not None:
        mind_map.connectors = data.connectors
    await db.commit()
    return {"id": mind_map.id, "title": mind_map.title}


@router.delete("/mindmap/{map_id}")
async def delete_mind_map(
    map_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.lean import MindMap
    fid = require_factory(user)
    result = await db.execute(
        select(MindMap).where(MindMap.id == map_id, MindMap.factory_id == fid)
    )
    mind_map = result.scalar_one_or_none()
    if not mind_map:
        raise HTTPException(status_code=404, detail="Mind map not found")
    await db.delete(mind_map)
    await db.commit()
    return {"status": "deleted"}
