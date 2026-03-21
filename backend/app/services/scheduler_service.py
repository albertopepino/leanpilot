"""
Scheduled Email Reports Service for LeanPilot.

Runs as background asyncio tasks alongside the FastAPI lifespan:
- Daily OEE summary (06:00 factory timezone)
- Weekly Kaizen digest (Monday 08:00 factory timezone)

Uses the same asyncio.Task pattern as data_retention.py for consistency.
"""
import asyncio
import structlog
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.models.lean import OEERecord, KaizenItem
from app.models.factory import Factory, ProductionLine
from app.models.company_settings import CompanySettings
from app.models.user import User
from app.services.email_service import EmailService

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


async def _generate_daily_oee_report(session: AsyncSession, factory_id: int) -> dict | None:
    """Generate daily OEE summary data for a factory."""
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    start_of_day = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)

    result = await session.execute(
        select(
            func.avg(OEERecord.oee).label("avg_oee"),
            func.avg(OEERecord.availability).label("avg_availability"),
            func.avg(OEERecord.performance).label("avg_performance"),
            func.avg(OEERecord.quality).label("avg_quality"),
            func.count(OEERecord.id).label("record_count"),
        )
        .join(ProductionLine, OEERecord.production_line_id == ProductionLine.id)
        .where(
            ProductionLine.factory_id == factory_id,
            OEERecord.date >= start_of_day,
            OEERecord.date < end_of_day,
        )
    )
    row = result.one_or_none()
    if not row or not row.record_count:
        return None

    return {
        "date": start_of_day.strftime("%Y-%m-%d"),
        "avg_oee": round(float(row.avg_oee or 0), 1),
        "avg_availability": round(float(row.avg_availability or 0), 1),
        "avg_performance": round(float(row.avg_performance or 0), 1),
        "avg_quality": round(float(row.avg_quality or 0), 1),
        "record_count": row.record_count,
    }


async def _generate_weekly_kaizen_report(session: AsyncSession, factory_id: int) -> dict | None:
    """Generate weekly Kaizen digest data for a factory."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # New items this week
    new_result = await session.execute(
        select(func.count(KaizenItem.id)).where(
            KaizenItem.factory_id == factory_id,
            KaizenItem.created_at >= week_ago,
        )
    )
    new_count = new_result.scalar() or 0

    # Completed this week
    completed_result = await session.execute(
        select(func.count(KaizenItem.id)).where(
            KaizenItem.factory_id == factory_id,
            KaizenItem.status == "completed",
            KaizenItem.updated_at >= week_ago,
        )
    )
    completed_count = completed_result.scalar() or 0

    # Total open
    open_result = await session.execute(
        select(func.count(KaizenItem.id)).where(
            KaizenItem.factory_id == factory_id,
            KaizenItem.status.in_(["open", "in_progress"]),
        )
    )
    open_count = open_result.scalar() or 0

    # Total savings this week
    savings_result = await session.execute(
        select(func.sum(KaizenItem.actual_savings_eur)).where(
            KaizenItem.factory_id == factory_id,
            KaizenItem.status == "completed",
            KaizenItem.updated_at >= week_ago,
        )
    )
    total_savings = savings_result.scalar() or 0

    if new_count == 0 and completed_count == 0:
        return None

    return {
        "period": f"{week_ago.strftime('%Y-%m-%d')} - {now.strftime('%Y-%m-%d')}",
        "new_count": new_count,
        "completed_count": completed_count,
        "open_count": open_count,
        "total_savings_eur": round(float(total_savings), 2),
    }


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------


def _oee_email_html(factory_name: str, data: dict, app_url: str) -> str:
    oee_color = "#10b981" if data["avg_oee"] >= 85 else "#f59e0b" if data["avg_oee"] >= 60 else "#ef4444"
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">Daily OEE Summary</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">{factory_name} — {data['date']}</p>
    </div>
    <div style="padding: 32px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; font-weight: 800; color: {oee_color};">{data['avg_oee']}%</div>
        <div style="font-size: 14px; color: #6b7280;">Overall OEE</div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 24px; font-weight: 700; color: #374151;">{data['avg_availability']}%</div>
            <div style="font-size: 11px; color: #9ca3af;">Availability</div>
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 24px; font-weight: 700; color: #374151;">{data['avg_performance']}%</div>
            <div style="font-size: 11px; color: #9ca3af;">Performance</div>
          </td>
          <td style="padding: 12px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 24px; font-weight: 700; color: #374151;">{data['avg_quality']}%</div>
            <div style="font-size: 11px; color: #9ca3af;">Quality</div>
          </td>
        </tr>
      </table>
      <p style="font-size: 12px; color: #9ca3af; margin-top: 16px; text-align: center;">
        Based on {data['record_count']} production records
      </p>
      <div style="text-align: center; margin-top: 24px;">
        <a href="{app_url}/operations/oee"
           style="display: inline-block; background: #4f46e5; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 13px;">
          View Full Dashboard →
        </a>
      </div>
    </div>
    <div style="background: #f9fafb; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">LeanPilot — Automated Daily Report</p>
    </div>
  </div>
</body>
</html>"""


def _kaizen_email_html(factory_name: str, data: dict, app_url: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">Weekly Kaizen Digest</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">{factory_name} — {data['period']}</p>
    </div>
    <div style="padding: 32px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: 800; color: #4f46e5;">{data['new_count']}</div>
            <div style="font-size: 11px; color: #9ca3af;">New Ideas</div>
          </td>
          <td style="padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: 800; color: #10b981;">{data['completed_count']}</div>
            <div style="font-size: 11px; color: #9ca3af;">Completed</div>
          </td>
          <td style="padding: 16px; text-align: center; border: 1px solid #e5e7eb;">
            <div style="font-size: 32px; font-weight: 800; color: #f59e0b;">{data['open_count']}</div>
            <div style="font-size: 11px; color: #9ca3af;">Open Items</div>
          </td>
        </tr>
      </table>
      {f'<div style="text-align: center; background: #f0fdf4; border-radius: 8px; padding: 12px; margin-bottom: 20px;"><span style="font-size: 14px; color: #059669; font-weight: 600;">Total Savings: €{data["total_savings_eur"]:,.2f}</span></div>' if data['total_savings_eur'] > 0 else ''}
      <div style="text-align: center;">
        <a href="{app_url}/improvement/kaizen"
           style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 13px;">
          View Kaizen Board →
        </a>
      </div>
    </div>
    <div style="background: #f9fafb; padding: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">LeanPilot — Automated Weekly Report</p>
    </div>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Send report functions
# ---------------------------------------------------------------------------


async def send_daily_oee_report(factory_id: int, recipients: list[str], factory_name: str):
    """Generate and send daily OEE summary to configured recipients."""
    async with async_session() as session:
        data = await _generate_daily_oee_report(session, factory_id)
        if not data:
            logger.info("email_report.oee.no_data", factory_id=factory_id)
            return

        from app.core.config import get_settings
        app_url = get_settings().app_url
        html = _oee_email_html(factory_name, data, app_url)

        for email in recipients:
            await EmailService._send(email, f"Daily OEE Summary — {factory_name} — {data['date']}", html)

        logger.info("email_report.oee.sent", factory_id=factory_id, recipients=len(recipients))


async def send_weekly_kaizen_report(factory_id: int, recipients: list[str], factory_name: str):
    """Generate and send weekly Kaizen digest to configured recipients."""
    async with async_session() as session:
        data = await _generate_weekly_kaizen_report(session, factory_id)
        if not data:
            logger.info("email_report.kaizen.no_data", factory_id=factory_id)
            return

        from app.core.config import get_settings
        app_url = get_settings().app_url
        html = _kaizen_email_html(factory_name, data, app_url)

        for email in recipients:
            await EmailService._send(email, f"Weekly Kaizen Digest — {factory_name}", html)

        logger.info("email_report.kaizen.sent", factory_id=factory_id, recipients=len(recipients))


# ---------------------------------------------------------------------------
# Background scheduler loops
# ---------------------------------------------------------------------------

_oee_task: asyncio.Task | None = None
_kaizen_task: asyncio.Task | None = None


async def _daily_oee_loop():
    """Run daily OEE report at approximately 06:00 UTC for each enabled factory."""
    logger.info("email_report.oee_scheduler_started")
    while True:
        try:
            # Calculate seconds until next 06:00 UTC
            now = datetime.now(timezone.utc)
            target = now.replace(hour=6, minute=0, second=0, microsecond=0)
            if now >= target:
                target += timedelta(days=1)
            wait_seconds = (target - now).total_seconds()

            await asyncio.sleep(wait_seconds)

            # Find all factories with email reports enabled
            async with async_session() as session:
                result = await session.execute(
                    select(CompanySettings, Factory.name).join(
                        Factory, Factory.id == CompanySettings.factory_id
                    ).where(
                        CompanySettings.email_reports_enabled == True,  # noqa: E712
                        CompanySettings.daily_oee_recipients != None,  # noqa: E711
                    )
                )
                for settings, factory_name in result.all():
                    recipients = settings.daily_oee_recipients or []
                    if recipients:
                        try:
                            await send_daily_oee_report(
                                settings.factory_id, recipients, factory_name
                            )
                        except Exception:
                            logger.exception(
                                "email_report.oee.factory_failed",
                                factory_id=settings.factory_id,
                            )

        except asyncio.CancelledError:
            logger.info("email_report.oee_scheduler_stopped")
            raise
        except Exception:
            logger.exception("email_report.oee_loop_error")
            await asyncio.sleep(3600)  # Retry in 1 hour on error


async def _weekly_kaizen_loop():
    """Run weekly Kaizen digest on Monday at 08:00 UTC for each enabled factory."""
    logger.info("email_report.kaizen_scheduler_started")
    while True:
        try:
            # Calculate seconds until next Monday 08:00 UTC
            now = datetime.now(timezone.utc)
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0 and now.hour >= 8:
                days_until_monday = 7
            target = (now + timedelta(days=days_until_monday)).replace(
                hour=8, minute=0, second=0, microsecond=0
            )
            wait_seconds = (target - now).total_seconds()

            await asyncio.sleep(wait_seconds)

            # Find all factories with email reports enabled
            async with async_session() as session:
                result = await session.execute(
                    select(CompanySettings, Factory.name).join(
                        Factory, Factory.id == CompanySettings.factory_id
                    ).where(
                        CompanySettings.email_reports_enabled == True,  # noqa: E712
                        CompanySettings.weekly_kaizen_recipients != None,  # noqa: E711
                    )
                )
                for settings, factory_name in result.all():
                    recipients = settings.weekly_kaizen_recipients or []
                    if recipients:
                        try:
                            await send_weekly_kaizen_report(
                                settings.factory_id, recipients, factory_name
                            )
                        except Exception:
                            logger.exception(
                                "email_report.kaizen.factory_failed",
                                factory_id=settings.factory_id,
                            )

        except asyncio.CancelledError:
            logger.info("email_report.kaizen_scheduler_stopped")
            raise
        except Exception:
            logger.exception("email_report.kaizen_loop_error")
            await asyncio.sleep(3600)  # Retry in 1 hour on error


def start_email_scheduler():
    """Start email report background tasks. Safe to call from FastAPI lifespan."""
    global _oee_task, _kaizen_task
    if _oee_task is None or _oee_task.done():
        _oee_task = asyncio.create_task(_daily_oee_loop())
    if _kaizen_task is None or _kaizen_task.done():
        _kaizen_task = asyncio.create_task(_weekly_kaizen_loop())
    logger.info("email_report.scheduler_created")


def stop_email_scheduler():
    """Cancel email report background tasks."""
    global _oee_task, _kaizen_task
    for task in (_oee_task, _kaizen_task):
        if task and not task.done():
            task.cancel()
    _oee_task = None
    _kaizen_task = None
    logger.info("email_report.scheduler_stopped")
