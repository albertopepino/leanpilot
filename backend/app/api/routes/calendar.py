"""
Master Calendar API
───────────────────
Unified calendar aggregating events from all LeanPilot tools.
"""

from datetime import date, datetime, time, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user, require_factory
from app.models.user import User
from app.schemas.calendar import CalendarEventsResponse
from app.services.calendar_service import CalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events", response_model=CalendarEventsResponse)
async def get_calendar_events(
    date_from: date,
    date_to: date,
    sources: list[str] | None = Query(None),
    line_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return aggregated calendar events across all LeanPilot tools."""
    fid = require_factory(user)

    # Convert date boundaries to timezone-aware datetimes for DB queries
    dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    dt_to = datetime.combine(date_to, time.max, tzinfo=timezone.utc)

    events = await CalendarService.get_events(
        db=db,
        factory_id=fid,
        dt_from=dt_from,
        dt_to=dt_to,
        sources=sources,
        line_id=line_id,
    )

    return CalendarEventsResponse(
        events=events,
        date_from=date_from,
        date_to=date_to,
    )
