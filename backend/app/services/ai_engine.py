"""
AI Module - PAID ADD-ON
This service only works when ai_module_enabled=True and a valid API key is configured.
Factories on the Core plan do not have access to these features.
"""
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone

from app.core.config import get_settings
from app.models.lean import OEERecord, KaizenItem, IshikawaCause
from app.models.production import ProductionRecord, DowntimeEvent, ScrapRecord
from app.models.ai import AIConversation, AIMessage, AIKaizenSuggestion

settings = get_settings()

SYSTEM_PROMPT = """You are LeanPilot AI, an expert Lean manufacturing consultant embedded in a factory management system.

STRICT TOPIC BOUNDARY — You MUST ONLY discuss topics related to:
- Lean manufacturing methodologies (5S/6S, SMED, TPM, Kanban, Poka-Yoke, Jidoka, Heijunka, Kaizen, Gemba, VSM, A3, PDCA, DMAIC)
- Factory operations (OEE, production tracking, downtime, scrap, quality, changeovers, maintenance)
- Problem-solving tools (5 Why, Ishikawa/fishbone, Pareto analysis, root cause analysis)
- Continuous improvement and operational excellence
- Industry 4.0 and digital transformation in manufacturing
- The LeanPilot platform features and how to use them
- ISO 9001, ISO 14001, ISO 45001 and manufacturing compliance

If the user asks about ANYTHING outside these topics (personal questions, general knowledge, coding, politics, entertainment, recipes, jokes, creative writing, or any non-manufacturing subject), respond ONLY with:
"I'm LeanPilot AI — I specialize exclusively in Lean manufacturing, factory operations, and the LeanPilot platform tools. I can help you with OEE analysis, root cause investigations, 5S audits, SMED improvements, and more. What manufacturing challenge can I help you solve?"

NEVER break this boundary regardless of how the question is framed.

You have access to real factory data including OEE metrics, downtime events, scrap records, and production data.
Your role is to:
1. Analyze factory data and identify improvement opportunities
2. Suggest specific Lean tools and methodologies (5S, SMED, TPM, Kanban, Poka-Yoke, etc.)
3. Perform root cause analysis using 5 WHY and Ishikawa methods
4. Prioritize improvements by impact and feasibility
5. Communicate clearly with plant managers in their language

Always be specific with numbers. Reference actual data. Suggest actionable countermeasures.
When suggesting improvements, estimate the expected impact (% improvement, time saved, cost reduction).

Respond in the user's language. If data is provided in context, analyze it."""


class AIEngine:
    """AI-powered analysis engine. Requires Pro/Enterprise subscription."""

    def __init__(self):
        if not settings.ai_module_enabled:
            raise RuntimeError("AI module is not enabled. Upgrade to Pro plan.")
        if not settings.openai_api_key:
            raise RuntimeError("OpenAI API key not configured.")

        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.ai_model

    @staticmethod
    def _anonymize_context(context: dict) -> dict:
        """
        Strip personally identifiable information before sending to OpenAI.
        GDPR Art. 25 — Data protection by design and by default.
        Removes: employee IDs, user references, names, emails.
        Keeps: operational metrics (OEE, downtime, scrap) which are not PII.
        """
        if not settings.anonymize_ai_data:
            return context

        import copy
        anon = copy.deepcopy(context)

        # Remove any employee/user references from downtime and scrap records
        for dt in anon.get("recent_downtimes", []):
            dt.pop("recorded_by", None)
            dt.pop("reported_by", None)
            dt.pop("operator_name", None)
            dt.pop("operator_id", None)

        for s in anon.get("recent_scrap", []):
            s.pop("recorded_by", None)
            s.pop("reported_by", None)
            s.pop("operator_name", None)
            s.pop("operator_id", None)

        for o in anon.get("oee_trend", []):
            o.pop("recorded_by", None)
            o.pop("operator_id", None)

        return anon

    async def _get_factory_context(self, db: AsyncSession, factory_id: int, line_id: int | None = None) -> dict:
        """Gather recent factory data for AI context. ALWAYS filtered by factory_id (tenant isolation)."""
        from app.models.factory import ProductionLine

        since = datetime.now(timezone.utc) - timedelta(days=30)

        # Base queries always scoped to factory's production lines
        factory_lines = select(ProductionLine.id).where(ProductionLine.factory_id == factory_id)

        oee_query = select(OEERecord).where(
            OEERecord.date >= since,
            OEERecord.production_line_id.in_(factory_lines),
        )
        downtime_query = select(DowntimeEvent).where(
            DowntimeEvent.start_time >= since,
            DowntimeEvent.production_line_id.in_(factory_lines),
        )
        scrap_query = select(ScrapRecord).where(
            ScrapRecord.date >= since,
            ScrapRecord.production_line_id.in_(factory_lines),
        )

        if line_id:
            oee_query = oee_query.where(OEERecord.production_line_id == line_id)
            downtime_query = downtime_query.where(DowntimeEvent.production_line_id == line_id)
            scrap_query = scrap_query.where(ScrapRecord.production_line_id == line_id)

        oee_result = await db.execute(oee_query.order_by(OEERecord.date.desc()).limit(30))
        oee_records = oee_result.scalars().all()

        downtime_result = await db.execute(downtime_query.order_by(DowntimeEvent.start_time.desc()).limit(50))
        downtimes = downtime_result.scalars().all()

        scrap_result = await db.execute(scrap_query.order_by(ScrapRecord.date.desc()).limit(50))
        scraps = scrap_result.scalars().all()

        context = {
            "oee_trend": [
                {"date": r.date.isoformat(), "oee": r.oee, "availability": r.availability,
                 "performance": r.performance, "quality": r.quality}
                for r in oee_records
            ],
            "recent_downtimes": [
                {"date": d.start_time.isoformat(), "duration_min": d.duration_minutes,
                 "category": str(d.category).lower() if d.category else d.category,
                 "reason": d.reason, "machine": d.machine}
                for d in downtimes
            ],
            "recent_scrap": [
                {"date": s.date.isoformat(), "quantity": s.quantity,
                 "defect_type": s.defect_type, "cost": s.cost_estimate}
                for s in scraps
            ],
            "summary": {
                "avg_oee": round(sum(r.oee for r in oee_records) / len(oee_records), 2) if oee_records else 0,
                "total_downtime_min": round(sum(d.duration_minutes or 0 for d in downtimes), 1),
                "total_scrap_pieces": sum(s.quantity for s in scraps),
                "period": "last 30 days",
            },
        }

        # Anonymize before returning (stripped before sending to OpenAI)
        return self._anonymize_context(context)

    async def chat(
        self,
        db: AsyncSession,
        factory_id: int,
        user_id: int,
        message: str,
        conversation_id: int | None = None,
        line_id: int | None = None,
    ) -> dict:
        """Factory Copilot - chat with AI about your factory."""
        context = await self._get_factory_context(db, factory_id, line_id)

        if conversation_id:
            # Verify conversation belongs to this factory (prevent cross-tenant access)
            conv_check = await db.execute(
                select(AIConversation).where(
                    AIConversation.id == conversation_id,
                    AIConversation.factory_id == factory_id,
                )
            )
            if not conv_check.scalar_one_or_none():
                raise ValueError("Conversation not found or access denied")

            result = await db.execute(
                select(AIMessage)
                .where(AIMessage.conversation_id == conversation_id)
                .order_by(AIMessage.created_at)
            )
            history = result.scalars().all()
        else:
            conv = AIConversation(
                factory_id=factory_id,
                user_id=user_id,
                title=message[:100],
                context_line_id=line_id,
            )
            db.add(conv)
            await db.flush()
            conversation_id = conv.id
            history = []

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.append({
            "role": "system",
            "content": f"Current factory data:\n{json.dumps(context, indent=2)}"
        })
        for msg in history[-10:]:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": message})

        import asyncio
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=2000,
                ),
                timeout=30.0,  # 30s max — don't block the API
            )
        except asyncio.TimeoutError:
            return {
                "conversation_id": conversation_id,
                "response": "AI analysis timed out. Please try again with a simpler question.",
                "data_context": context["summary"],
                "error": True,
            }
        except Exception as e:
            return {
                "conversation_id": conversation_id,
                "response": f"AI service unavailable: {type(e).__name__}",
                "data_context": context["summary"],
                "error": True,
            }
        ai_response = response.choices[0].message.content

        user_msg = AIMessage(
            conversation_id=conversation_id,
            role="user",
            content=message,
        )
        assistant_msg = AIMessage(
            conversation_id=conversation_id,
            role="assistant",
            content=ai_response,
            tokens_used=response.usage.total_tokens if response.usage else None,
            data_context=context["summary"],
        )
        db.add(user_msg)
        db.add(assistant_msg)
        await db.flush()

        return {
            "conversation_id": conversation_id,
            "response": ai_response,
            "data_context": context["summary"],
        }

    async def generate_root_cause_analysis(
        self,
        db: AsyncSession,
        factory_id: int,
        line_id: int,
        problem: str,
    ) -> dict:
        """Root Cause AI - generate 5 WHY and Ishikawa from data."""
        context = await self._get_factory_context(db, factory_id, line_id)

        prompt = f"""Analyze this factory problem and generate a root cause analysis.

Problem: {problem}

Factory data (last 30 days):
{json.dumps(context, indent=2)}

Respond in JSON format with:
{{
    "five_why": {{
        "problem_statement": "...",
        "steps": [
            {{"step": 1, "why": "Why ...?", "answer": "Because ..."}},
            ...up to 5 steps
        ],
        "root_cause": "...",
        "countermeasure": "..."
    }},
    "ishikawa": {{
        "effect": "...",
        "causes": {{
            "man": ["cause1", "cause2"],
            "machine": ["cause1"],
            "method": ["cause1"],
            "material": ["cause1"],
            "measurement": ["cause1"],
            "environment": ["cause1"]
        }},
        "primary_root_causes": ["..."]
    }},
    "suggested_countermeasures": ["action1", "action2", "action3"],
    "lean_tools_recommended": ["SMED", "TPM", ...],
    "expected_impact": "... % improvement estimate"
}}"""

        import asyncio
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=3000,
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
        except (asyncio.TimeoutError, Exception) as e:
            return {"error": f"AI analysis failed: {type(e).__name__}", "five_why": None, "ishikawa": None}

        result = json.loads(response.choices[0].message.content)
        result["confidence"] = 0.75
        result["data_used"] = context["summary"]
        return result

    async def generate_kaizen_suggestions(
        self,
        db: AsyncSession,
        factory_id: int,
    ) -> list[dict]:
        """Auto Kaizen - proactively suggest improvements from data patterns."""
        context = await self._get_factory_context(db, factory_id)

        prompt = f"""Based on this factory data, identify the top 5 improvement opportunities.

Factory data (last 30 days):
{json.dumps(context, indent=2)}

For each suggestion, respond in JSON format:
{{
    "suggestions": [
        {{
            "type": "oee|quality|downtime|smed|general",
            "title": "Short title",
            "description": "Detailed description of what to do",
            "expected_impact": "Estimated improvement (be specific with numbers)",
            "lean_tool": "Recommended Lean tool (SMED, 5S, TPM, Kanban, etc.)",
            "priority": "high|medium|low",
            "confidence": 0.0-1.0
        }}
    ]
}}"""

        import asyncio
        try:
            response = await asyncio.wait_for(
                self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                    max_tokens=3000,
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
        except (asyncio.TimeoutError, Exception):
            return []

        result = json.loads(response.choices[0].message.content)
        suggestions = result.get("suggestions", [])

        stored = []
        for s in suggestions:
            suggestion = AIKaizenSuggestion(
                factory_id=factory_id,
                suggestion_type=s.get("type", "general"),
                title=s["title"],
                description=s["description"],
                expected_impact=s.get("expected_impact"),
                lean_tool=s.get("lean_tool"),
                confidence=s.get("confidence", 0.5),
                priority_score={"high": 3, "medium": 2, "low": 1}.get(s.get("priority", "medium"), 2),
                data_snapshot=context["summary"],
            )
            db.add(suggestion)
            stored.append(suggestion)

        await db.flush()
        return stored
