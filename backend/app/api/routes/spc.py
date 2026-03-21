"""SPC API routes — Statistical Process Control charts and calculations."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.schemas.spc import (
    SPCCalculateRequest, SPCCalculateResponse, SPCLineConfig,
)
from app.services.spc_service import calculate_spc
from app.services.qc_service import NCRService

router = APIRouter(prefix="/spc", tags=["spc"])


# ─── SPC → NCR Trigger ──────────────────────────────────────────────────────


class SPCTriggerNCRRequest(BaseModel):
    """Request to create an NCR from an SPC out-of-control signal."""
    production_line_id: int
    rule_violated: str  # e.g. "Rule 1: Beyond 3-sigma"
    sample_number: int | None = None
    measured_value: float | None = None
    ucl: float | None = None
    lcl: float | None = None
    chart_type: str = "xbar_r"


@router.post("/trigger-ncr")
async def trigger_ncr_from_spc(
    data: SPCTriggerNCRRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create an NCR from an SPC out-of-control signal."""
    from app.models.factory import ProductionLine

    fid = require_factory(user)

    # Verify production line belongs to factory
    line_q = select(ProductionLine).where(
        ProductionLine.id == data.production_line_id,
        ProductionLine.factory_id == fid,
    )
    line_result = await db.execute(line_q)
    line = line_result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Production line not found")

    # Determine severity: Rule 1 (beyond 3-sigma) = major, others = minor
    rule_lower = data.rule_violated.lower()
    severity = "major" if "rule 1" in rule_lower or "beyond 3" in rule_lower else "minor"

    # Build description with SPC data details
    desc_parts = [
        f"Auto-generated NCR from SPC out-of-control signal.",
        f"Production Line: {line.name}",
        f"Chart Type: {data.chart_type}",
        f"Rule Violated: {data.rule_violated}",
    ]
    if data.measured_value is not None:
        desc_parts.append(f"Measured Value: {data.measured_value}")
    if data.ucl is not None:
        desc_parts.append(f"UCL: {data.ucl}")
    if data.lcl is not None:
        desc_parts.append(f"LCL: {data.lcl}")
    if data.sample_number is not None:
        desc_parts.append(f"Sample/Subgroup: {data.sample_number}")

    ncr_data = {
        "production_line_id": data.production_line_id,
        "title": f"SPC Out-of-Control: {data.rule_violated} on {data.chart_type}",
        "description": "\n".join(desc_parts),
        "severity": severity,
    }

    ncr = await NCRService.create(db, fid, user.id, ncr_data)

    return {
        "id": ncr.id,
        "ncr_number": ncr.ncr_number,
        "title": ncr.title,
        "severity": ncr.severity,
        "status": ncr.status,
    }


@router.get("/data")
async def get_spc_data(
    line_id: int | None = None,
    product_id: int | None = None,
    check_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    subgroup_size: int = Query(default=5, ge=2, le=25),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Fetch measurement data from QC records, grouped into subgroups for SPC analysis."""
    from app.models.qc import QCRecord, QCCheckResultRecord, QCRecordStatus

    fid = require_factory(user)

    # Build query for completed QC records with measured values
    q = (
        select(QCCheckResultRecord)
        .join(QCRecord, QCCheckResultRecord.qc_record_id == QCRecord.id)
        .where(
            QCRecord.factory_id == fid,
            QCRecord.status.in_([QCRecordStatus.PASSED, QCRecordStatus.PASSED_WITH_DEVIATIONS]),
            QCCheckResultRecord.measured_value.isnot(None),
        )
    )

    if line_id:
        q = q.where(QCRecord.production_line_id == line_id)
    if check_type:
        q = q.where(QCRecord.check_type == check_type)
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from)
            q = q.where(QCRecord.started_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to)
            q = q.where(QCRecord.started_at <= dt_to)
        except ValueError:
            pass

    q = q.order_by(QCRecord.started_at)
    result = await db.execute(q)
    records = result.scalars().all()

    # Extract measured values
    values = [r.measured_value for r in records if r.measured_value is not None]

    # Group into subgroups
    subgroups: list[list[float]] = []
    labels: list[str] = []
    for i in range(0, len(values) - subgroup_size + 1, subgroup_size):
        subgroups.append(values[i:i + subgroup_size])
        labels.append(f"SG {len(subgroups)}")

    return {
        "measurements": subgroups,
        "subgroup_labels": labels,
        "total_values": len(values),
        "subgroup_size": subgroup_size,
        "total_subgroups": len(subgroups),
    }


@router.post("/calculate", response_model=SPCCalculateResponse)
async def calculate_spc_charts(
    data: SPCCalculateRequest,
    user: User = Depends(get_current_user),
):
    """Calculate control limits, capability indices, and WECO rule violations."""
    require_factory(user)

    if len(data.measurements) < 2:
        raise HTTPException(400, "At least 2 subgroups required for SPC analysis")

    try:
        result = calculate_spc(
            chart_type=data.chart_type,
            measurements=data.measurements,
            subgroup_size=data.subgroup_size,
            usl=data.usl,
            lsl=data.lsl,
            sample_sizes=data.sample_sizes,
        )
    except ValueError:
        raise HTTPException(400, "SPC calculation error: invalid input data")

    return SPCCalculateResponse(
        chart_type=result["chart_type"],
        subgroup_size=result["subgroup_size"],
        total_subgroups=result["total_subgroups"],
        charts=result["charts"],
        capability=result.get("capability"),
        pct_in_control=result["pct_in_control"],
    )


@router.get("/charts/{line_id}")
async def get_spc_chart_for_line(
    line_id: int,
    chart_type: str = "xbar_r",
    subgroup_size: int = Query(default=5, ge=2, le=25),
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get SPC chart configuration and calculated data for a specific production line."""
    from app.models.qc import QCRecord, QCCheckResultRecord, QCRecordStatus
    from app.models.factory import ProductionLine

    fid = require_factory(user)

    # Verify line belongs to factory
    line_q = select(ProductionLine).where(
        ProductionLine.id == line_id,
        ProductionLine.factory_id == fid,
    )
    line_result = await db.execute(line_q)
    line = line_result.scalar_one_or_none()
    if not line:
        raise HTTPException(404, "Production line not found")

    # Fetch measurement data
    q = (
        select(QCCheckResultRecord)
        .join(QCRecord, QCCheckResultRecord.qc_record_id == QCRecord.id)
        .where(
            QCRecord.factory_id == fid,
            QCRecord.production_line_id == line_id,
            QCRecord.status.in_([QCRecordStatus.PASSED, QCRecordStatus.PASSED_WITH_DEVIATIONS]),
            QCCheckResultRecord.measured_value.isnot(None),
        )
    )

    if date_from:
        try:
            q = q.where(QCRecord.started_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.where(QCRecord.started_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    q = q.order_by(QCRecord.started_at)
    result = await db.execute(q)
    records = result.scalars().all()

    values = [r.measured_value for r in records if r.measured_value is not None]

    # Group into subgroups
    subgroups: list[list[float]] = []
    labels: list[str] = []
    for i in range(0, len(values) - subgroup_size + 1, subgroup_size):
        subgroups.append(values[i:i + subgroup_size])
        labels.append(f"SG {len(subgroups)}")

    # Calculate if enough data
    spc_result = None
    if len(subgroups) >= 2:
        try:
            spc_result = calculate_spc(
                chart_type=chart_type,
                measurements=subgroups,
                subgroup_size=subgroup_size,
            )
        except ValueError:
            pass

    return {
        "line_id": line_id,
        "line_name": line.name,
        "chart_type": chart_type,
        "subgroup_size": subgroup_size,
        "measurements": subgroups,
        "subgroup_labels": labels,
        "spc_result": spc_result,
    }
