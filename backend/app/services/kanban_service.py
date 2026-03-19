from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timezone, timedelta

from app.models.kanban import KanbanBoard, KanbanCard


class KanbanService:
    """Business logic for Kanban boards — metrics, WIP limits, lead/cycle time."""

    # ─── WIP limit checking ───────────────────────────────────────────────

    @staticmethod
    async def get_column_counts(db: AsyncSession, board_id: int) -> dict[str, int]:
        """Return card count per column for a board."""
        result = await db.execute(
            select(
                KanbanCard.column_name,
                func.count(KanbanCard.id).label("count"),
            )
            .where(
                KanbanCard.board_id == board_id,
                KanbanCard.status == "active",
            )
            .group_by(KanbanCard.column_name)
        )
        return {row.column_name: row.count for row in result.all()}

    @staticmethod
    def check_wip_limit(
        wip_limits: dict[str, int],
        column_counts: dict[str, int],
        column_name: str,
    ) -> dict:
        """Check whether a column is at/over its WIP limit.

        Returns {"status": "ok" | "warning" | "exceeded", "current": int, "limit": int}.
        A limit of 0 means unlimited.
        """
        limit = wip_limits.get(column_name, 0)
        current = column_counts.get(column_name, 0)

        if limit <= 0:
            return {"status": "ok", "current": current, "limit": 0}

        if current >= limit:
            return {"status": "exceeded", "current": current, "limit": limit}
        if current >= limit - 1:
            return {"status": "warning", "current": current, "limit": limit}
        return {"status": "ok", "current": current, "limit": limit}

    # ─── Lead / cycle time computation ────────────────────────────────────

    @staticmethod
    def compute_lead_time(card: KanbanCard, first_column: str, last_column: str, target_column: str) -> KanbanCard:
        """Update lead_time_hours and cycle_time_hours on card move."""
        now = datetime.now(timezone.utc)

        # If card enters the first "active" column (in_queue or in_progress), record started_at
        if target_column not in ("backlog",) and card.started_at is None:
            card.started_at = now

        # If card reaches the last column, compute lead time
        if target_column == last_column:
            card.completed_at = now
            if card.started_at:
                delta = now - card.started_at
                card.lead_time_hours = round(delta.total_seconds() / 3600, 2)

        # Cycle time: time in "in_progress" column
        # We approximate as lead_time for now; real cycle time tracking
        # would require per-column timestamps (future enhancement).
        if card.completed_at and card.started_at:
            delta = card.completed_at - card.started_at
            card.cycle_time_hours = round(delta.total_seconds() / 3600, 2)

        return card

    # ─── Board metrics ────────────────────────────────────────────────────

    @staticmethod
    async def compute_metrics(db: AsyncSession, board_id: int, factory_id: int) -> dict:
        """Compute KPI metrics for a board."""
        now = datetime.now(timezone.utc)

        # All active cards
        result = await db.execute(
            select(KanbanCard).where(
                KanbanCard.board_id == board_id,
                KanbanCard.factory_id == factory_id,
                KanbanCard.status == "active",
            )
        )
        cards = result.scalars().all()

        # WIP by column
        wip_by_column: dict[str, int] = {}
        total_wip = 0
        for card in cards:
            wip_by_column[card.column_name] = wip_by_column.get(card.column_name, 0) + 1
            if card.column_name not in ("done", "shipped"):
                total_wip += 1

        # Completed cards (have lead_time)
        completed = [c for c in cards if c.completed_at is not None]
        lead_times = [c.lead_time_hours for c in completed if c.lead_time_hours is not None]
        cycle_times = [c.cycle_time_hours for c in completed if c.cycle_time_hours is not None]

        avg_lead = round(sum(lead_times) / len(lead_times), 2) if lead_times else None
        avg_cycle = round(sum(cycle_times) / len(cycle_times), 2) if cycle_times else None

        # Throughput: cards completed in last 30 days / 30
        thirty_days_ago = now - timedelta(days=30)
        recent_completed = [
            c for c in completed
            if c.completed_at and c.completed_at >= thirty_days_ago
        ]
        throughput = round(len(recent_completed) / 30, 2) if recent_completed else 0

        # On-time delivery: completed cards where completed_at <= due_date
        cards_with_due = [c for c in completed if c.due_date is not None]
        if cards_with_due:
            on_time = sum(
                1 for c in cards_with_due
                if c.completed_at and c.completed_at <= c.due_date
            )
            on_time_pct = round((on_time / len(cards_with_due)) * 100, 1)
        else:
            on_time_pct = None

        # Overdue: active cards past due_date
        overdue = sum(
            1 for c in cards
            if c.due_date and c.completed_at is None and now > c.due_date
        )

        return {
            "total_wip": total_wip,
            "wip_by_column": wip_by_column,
            "avg_lead_time_hours": avg_lead,
            "avg_cycle_time_hours": avg_cycle,
            "throughput_per_day": throughput,
            "on_time_delivery_pct": on_time_pct,
            "total_completed": len(completed),
            "total_overdue": overdue,
        }
