"""
Lean Maturity Calculator — computes maturity scores from actual tool usage data.

Evaluates 12 categories aligned with the frontend assessment, scoring each 1–5
based on record counts and quality metrics within a rolling 90-day window.
"""

from __future__ import annotations

import structlog
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lean import (
    OEERecord, FiveWhyAnalysis, IshikawaAnalysis, KaizenItem, SMEDRecord,
)
from app.models.lean_advanced import (
    SixSAudit, VSMMap, A3Report, GembaWalk, TPMEquipment, TPMMaintenanceRecord,
    CILTExecution, AndonEvent, HourlyProduction,
)
from app.models.qc import QCRecord, NonConformanceReport, CAPAAction
from app.models.safety import SafetyIncident
from app.models.sqcdp import SQCDPEntry
from app.models.leader_standard_work import LeaderStandardWork, LSWCompletion
from app.models.kanban import KanbanBoard, KanbanCard
from app.models.ai import AIConversation
from app.models.lean import LeanAssessment

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Maturity level labels
# ---------------------------------------------------------------------------
MATURITY_LABELS = {
    1: "No Activity",
    2: "Initial",
    3: "Developing",
    4: "Managed",
    5: "World Class",
}


def _overall_label(score: float) -> str:
    """Map a fractional overall score to a maturity label."""
    if score >= 4.5:
        return "World Class"
    if score >= 3.5:
        return "Managed"
    if score >= 2.5:
        return "Developing"
    if score >= 1.5:
        return "Initial"
    return "No Activity"


def _score_from_count(n: int) -> int:
    """Basic count-to-maturity mapping (used as baseline)."""
    if n == 0:
        return 1
    if n <= 3:
        return 2
    if n <= 10:
        return 3
    if n <= 25:
        return 4
    return 5


class LeanMaturityCalculator:
    """Compute lean maturity scores from actual tool usage data."""

    def __init__(self, db: AsyncSession, factory_id: int, period_days: int = 90):
        self.db = db
        self.factory_id = factory_id
        self.period_days = period_days
        self.cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)

    # ------------------------------------------------------------------
    # Helper: count records for a model scoped to factory + period
    # ------------------------------------------------------------------
    async def _count(self, model, *, date_col=None, extra_filters=None) -> int:
        date_column = date_col or model.created_at
        filters = [
            model.factory_id == self.factory_id,
            date_column >= self.cutoff,
        ]
        if extra_filters:
            filters.extend(extra_filters)
        result = await self.db.execute(
            select(func.count(model.id)).where(*filters)
        )
        return result.scalar() or 0

    # ------------------------------------------------------------------
    # Category scorers
    # ------------------------------------------------------------------
    async def _score_workplace_5s(self) -> dict[str, Any]:
        """5S/6S audits: count + average score quality."""
        count = await self._count(SixSAudit)
        avg_result = await self.db.execute(
            select(func.avg(SixSAudit.overall_score)).where(
                SixSAudit.factory_id == self.factory_id,
                SixSAudit.created_at >= self.cutoff,
            )
        )
        avg_score = avg_result.scalar() or 0

        base = _score_from_count(count)
        # Boost to 5 if high count AND average score >= 80
        if count > 25 and avg_score >= 80:
            score = 5
        elif count > 10 and avg_score >= 70:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": count,
            "score": score,
            "avg_audit_score": round(avg_score, 1),
            "label": MATURITY_LABELS[score],
        }

    async def _score_visual_management(self) -> dict[str, Any]:
        """Andon events + SQCDP entries + hourly board entries."""
        andon_count = await self._count(AndonEvent)
        sqcdp_count = await self._count(SQCDPEntry)

        # HourlyProduction doesn't have factory_id directly — join through ProductionLine
        from app.models.factory import ProductionLine
        hp_result = await self.db.execute(
            select(func.count(HourlyProduction.id))
            .join(ProductionLine, ProductionLine.id == HourlyProduction.production_line_id)
            .where(
                ProductionLine.factory_id == self.factory_id,
                HourlyProduction.created_at >= self.cutoff,
            )
        )
        hp_count = hp_result.scalar() or 0

        total = andon_count + sqcdp_count + hp_count
        score = _score_from_count(total)

        return {
            "count": total,
            "score": score,
            "andon_events": andon_count,
            "sqcdp_entries": sqcdp_count,
            "hourly_entries": hp_count,
            "label": MATURITY_LABELS[score],
        }

    async def _score_standard_work(self) -> dict[str, Any]:
        """Leader Standard Work templates + CILT execution compliance."""
        lsw_count = await self._count(LeaderStandardWork)

        # LSW completions (joined through LSW factory_id)
        comp_result = await self.db.execute(
            select(func.count(LSWCompletion.id)).where(
                LSWCompletion.created_at >= self.cutoff,
                LSWCompletion.lsw_id.in_(
                    select(LeaderStandardWork.id).where(
                        LeaderStandardWork.factory_id == self.factory_id
                    )
                ),
            )
        )
        completion_count = comp_result.scalar() or 0

        # CILT executions (joined through CILTStandard factory_id)
        from app.models.lean_advanced import CILTStandard
        cilt_result = await self.db.execute(
            select(func.count(CILTExecution.id)).where(
                CILTExecution.created_at >= self.cutoff,
                CILTExecution.standard_id.in_(
                    select(CILTStandard.id).where(
                        CILTStandard.factory_id == self.factory_id
                    )
                ),
            )
        )
        cilt_count = cilt_result.scalar() or 0

        total = lsw_count + completion_count + cilt_count
        score = _score_from_count(total)

        return {
            "count": total,
            "score": score,
            "lsw_templates": lsw_count,
            "lsw_completions": completion_count,
            "cilt_executions": cilt_count,
            "label": MATURITY_LABELS[score],
        }

    async def _score_continuous_improvement(self) -> dict[str, Any]:
        """Kaizen items completed/verified + savings."""
        completed_count = await self._count(
            KaizenItem,
            extra_filters=[
                func.lower(KaizenItem.status).in_(
                    ["completed", "verified", "standardized"]
                ),
            ],
        )
        total_count = await self._count(KaizenItem)

        # Sum of verified savings
        savings_result = await self.db.execute(
            select(func.coalesce(func.sum(KaizenItem.expected_savings_eur), 0)).where(
                KaizenItem.factory_id == self.factory_id,
                KaizenItem.created_at >= self.cutoff,
                func.lower(KaizenItem.status).in_(
                    ["completed", "verified", "standardized"]
                ),
            )
        )
        total_savings = savings_result.scalar() or 0

        base = _score_from_count(completed_count)
        # Boost if high completion rate AND savings tracked
        if completed_count > 25 and total_savings > 0:
            score = 5
        elif completed_count > 10 and total_count > 0 and (completed_count / total_count) >= 0.6:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": completed_count,
            "score": score,
            "total_kaizen": total_count,
            "completed_kaizen": completed_count,
            "total_savings_eur": round(total_savings, 2),
            "label": MATURITY_LABELS[score],
        }

    async def _score_problem_solving(self) -> dict[str, Any]:
        """5-Why + Ishikawa + A3 reports."""
        five_why = await self._count(FiveWhyAnalysis)
        ishikawa = await self._count(IshikawaAnalysis)
        a3 = await self._count(A3Report)
        total = five_why + ishikawa + a3

        # Tool diversity bonus: using all three tools indicates higher maturity
        tools_used = sum(1 for c in [five_why, ishikawa, a3] if c > 0)
        base = _score_from_count(total)
        if total > 25 and tools_used >= 3:
            score = 5
        elif total > 10 and tools_used >= 2:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": total,
            "score": score,
            "five_why": five_why,
            "ishikawa": ishikawa,
            "a3_reports": a3,
            "tools_used": tools_used,
            "label": MATURITY_LABELS[score],
        }

    async def _score_tpm_equipment(self) -> dict[str, Any]:
        """TPM maintenance records + OEE (equipment uptime proxy)."""
        # TPMMaintenanceRecord has no factory_id — join through TPMEquipment
        tpm_result = await self.db.execute(
            select(func.count(TPMMaintenanceRecord.id))
            .join(TPMEquipment, TPMEquipment.id == TPMMaintenanceRecord.equipment_id)
            .where(
                TPMEquipment.factory_id == self.factory_id,
                TPMMaintenanceRecord.created_at >= self.cutoff,
            )
        )
        tpm_count = tpm_result.scalar() or 0

        # OEERecord has no factory_id — join through ProductionLine
        from app.models.factory import ProductionLine
        oee_result = await self.db.execute(
            select(func.avg(OEERecord.oee), func.count(OEERecord.id))
            .join(ProductionLine, ProductionLine.id == OEERecord.production_line_id)
            .where(
                ProductionLine.factory_id == self.factory_id,
                OEERecord.date >= self.cutoff,
            )
        )
        row = oee_result.one_or_none()
        oee_avg = (row[0] or 0) if row else 0
        oee_count = (row[1] or 0) if row else 0

        # OEE-based score
        if oee_count == 0:
            oee_score = 1
        elif oee_avg >= 85:
            oee_score = 5
        elif oee_avg >= 75:
            oee_score = 4
        elif oee_avg >= 60:
            oee_score = 3
        elif oee_avg >= 40:
            oee_score = 2
        else:
            oee_score = 1

        tpm_score = _score_from_count(tpm_count)
        # Weighted blend: TPM activity 60%, OEE result 40%
        score = round(tpm_score * 0.6 + oee_score * 0.4)
        score = max(1, min(5, score))

        return {
            "count": tpm_count + oee_count,
            "score": score,
            "tpm_records": tpm_count,
            "oee_records": oee_count,
            "oee_average": round(oee_avg, 1),
            "label": MATURITY_LABELS[score],
        }

    async def _score_flow_pull(self) -> dict[str, Any]:
        """Kanban card throughput + SMED records + VSM maps."""
        kanban_cards = await self._count(KanbanCard)
        smed = await self._count(SMEDRecord)
        vsm = await self._count(VSMMap)
        total = kanban_cards + smed + vsm
        score = _score_from_count(total)

        return {
            "count": total,
            "score": score,
            "kanban_cards": kanban_cards,
            "smed_records": smed,
            "vsm_maps": vsm,
            "label": MATURITY_LABELS[score],
        }

    async def _score_quality_at_source(self) -> dict[str, Any]:
        """QC records + NCR + CAPA with closure-rate quality bonus."""
        qc = await self._count(QCRecord)
        ncr = await self._count(NonConformanceReport)
        capa = await self._count(CAPAAction)
        total = qc + ncr + capa

        # CAPA closure rate
        capa_closed = await self._count(
            CAPAAction,
            extra_filters=[
                func.lower(CAPAAction.status).in_(["closed", "verified"]),
            ],
        ) if capa > 0 else 0
        closure_rate = (capa_closed / capa * 100) if capa > 0 else 0

        base = _score_from_count(total)
        if total > 25 and closure_rate >= 80:
            score = 5
        elif total > 10 and closure_rate >= 50:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": total,
            "score": score,
            "qc_records": qc,
            "ncr_count": ncr,
            "capa_count": capa,
            "capa_closure_rate": round(closure_rate, 1),
            "label": MATURITY_LABELS[score],
        }

    async def _score_safety_culture(self) -> dict[str, Any]:
        """Safety incidents: severity trend + days without incident."""
        total = await self._count(SafetyIncident)

        # Severity breakdown
        severity_result = await self.db.execute(
            select(SafetyIncident.severity, func.count(SafetyIncident.id)).where(
                SafetyIncident.factory_id == self.factory_id,
                SafetyIncident.created_at >= self.cutoff,
            ).group_by(SafetyIncident.severity)
        )
        severity_map = {row[0]: row[1] for row in severity_result.all()}
        serious_plus = severity_map.get("serious", 0) + severity_map.get("critical", 0)

        # Days since last incident
        last_incident_result = await self.db.execute(
            select(func.max(SafetyIncident.date)).where(
                SafetyIncident.factory_id == self.factory_id,
            )
        )
        last_date = last_incident_result.scalar()
        if last_date:
            days_without = (datetime.now(timezone.utc).date() - last_date).days
        else:
            days_without = self.period_days  # no incidents on record

        # Near-miss reporting is positive (proactive culture)
        near_misses = severity_map.get("minor", 0) + severity_map.get("near_miss", 0)

        # Scoring: proactive reporting + low severity + days without serious
        if days_without >= 90 and near_misses >= 5 and serious_plus == 0:
            score = 5
        elif days_without >= 60 and serious_plus == 0:
            score = 4
        elif days_without >= 30:
            score = 3
        elif total > 0:
            score = 2
        else:
            # No incidents at all could mean no reporting (score 1) or genuinely safe
            score = 1

        return {
            "count": total,
            "score": score,
            "days_without_incident": days_without,
            "near_misses": near_misses,
            "serious_or_critical": serious_plus,
            "severity_breakdown": severity_map,
            "label": MATURITY_LABELS[score],
        }

    async def _score_leadership(self) -> dict[str, Any]:
        """Gemba walks + lean assessment completions."""
        gemba = await self._count(GembaWalk)
        assessments = await self._count(LeanAssessment)
        total = gemba + assessments

        # Gemba frequency matters more for leadership
        base = _score_from_count(total)
        if gemba >= 12 and assessments >= 2:  # weekly gemba + quarterly assessments
            score = max(base, 5)
        elif gemba >= 4 and assessments >= 1:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": total,
            "score": score,
            "gemba_walks": gemba,
            "assessments": assessments,
            "label": MATURITY_LABELS[score],
        }

    async def _score_supply_chain(self) -> dict[str, Any]:
        """Kanban card completion (on-time delivery proxy)."""
        # Cards moved to 'done' or 'shipped' columns
        done_cards = await self.db.execute(
            select(func.count(KanbanCard.id)).where(
                KanbanCard.factory_id == self.factory_id,
                KanbanCard.created_at >= self.cutoff,
                func.lower(KanbanCard.column_name).in_(["done", "shipped"]),
            )
        )
        done_count = done_cards.scalar() or 0
        total_cards = await self._count(KanbanCard)

        on_time_rate = (done_count / total_cards * 100) if total_cards > 0 else 0

        base = _score_from_count(total_cards)
        if total_cards > 25 and on_time_rate >= 80:
            score = 5
        elif total_cards > 10 and on_time_rate >= 60:
            score = max(base, 4)
        else:
            score = base

        return {
            "count": total_cards,
            "score": score,
            "total_cards": total_cards,
            "completed_cards": done_count,
            "on_time_rate": round(on_time_rate, 1),
            "label": MATURITY_LABELS[score],
        }

    async def _score_digital_industry4(self) -> dict[str, Any]:
        """AI copilot usage + data completeness across tools."""
        ai_conversations = await self._count(AIConversation)

        # Data completeness: count how many distinct tool types have records
        tool_checks = {
            "oee": OEERecord,
            "kaizen": KaizenItem,
            "five_why": FiveWhyAnalysis,
            "tpm": TPMMaintenanceRecord,
            "qc": QCRecord,
            "safety": SafetyIncident,
            "andon": AndonEvent,
            "sqcdp": SQCDPEntry,
        }
        active_tools = 0
        for _name, model in tool_checks.items():
            c = await self._count(model)
            if c > 0:
                active_tools += 1

        total = ai_conversations + active_tools

        if ai_conversations >= 10 and active_tools >= 6:
            score = 5
        elif ai_conversations >= 5 and active_tools >= 4:
            score = 4
        elif ai_conversations >= 1 and active_tools >= 2:
            score = 3
        elif active_tools >= 1:
            score = 2
        else:
            score = 1

        return {
            "count": total,
            "score": score,
            "ai_conversations": ai_conversations,
            "active_digital_tools": active_tools,
            "total_tool_types": len(tool_checks),
            "label": MATURITY_LABELS[score],
        }

    # ------------------------------------------------------------------
    # Main compute method
    # ------------------------------------------------------------------
    async def compute(self) -> dict[str, Any]:
        """Run all 12 category evaluations and return full maturity report."""
        categories = {
            "workplace_5s": await self._score_workplace_5s(),
            "visual_management": await self._score_visual_management(),
            "standard_work": await self._score_standard_work(),
            "continuous_improvement": await self._score_continuous_improvement(),
            "problem_solving": await self._score_problem_solving(),
            "tpm_equipment": await self._score_tpm_equipment(),
            "flow_pull": await self._score_flow_pull(),
            "quality_at_source": await self._score_quality_at_source(),
            "safety_culture": await self._score_safety_culture(),
            "leadership": await self._score_leadership(),
            "supply_chain": await self._score_supply_chain(),
            "digital_industry4": await self._score_digital_industry4(),
        }

        scores = [c["score"] for c in categories.values()]
        overall_score = round(sum(scores) / len(scores), 2)
        overall_level = _overall_label(overall_score)

        # Top recommendations: categories scoring <= 2
        recommendations = []
        for cat_key, cat_data in categories.items():
            if cat_data["score"] <= 2:
                recommendations.append({
                    "category": cat_key,
                    "current_score": cat_data["score"],
                    "suggestion": f"Increase {cat_key.replace('_', ' ')} activity — "
                                  f"currently at level {cat_data['score']} ({cat_data['label']})",
                })

        return {
            "categories": categories,
            "overall_score": overall_score,
            "overall_level": overall_level,
            "period_days": self.period_days,
            "factory_id": self.factory_id,
            "recommendations": recommendations,
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
