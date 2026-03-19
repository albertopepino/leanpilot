from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

from app.models.pokayoke import PokaYokeDevice, PokaYokeVerification


# Frequency → timedelta mapping
FREQUENCY_DELTA = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
    "monthly": timedelta(days=30),
}


class PokaYokeService:
    """Business logic for Poka-Yoke device registry and verification."""

    @staticmethod
    def is_overdue(device: PokaYokeDevice) -> bool:
        """Check whether a device is past its verification due date."""
        if device.status != "active":
            return False
        if device.last_verified_at is None:
            # Never verified → overdue
            return True
        delta = FREQUENCY_DELTA.get(device.verification_frequency, timedelta(weeks=1))
        return datetime.now(timezone.utc) > device.last_verified_at + delta

    @staticmethod
    async def get_overdue_devices(db: AsyncSession, factory_id: int) -> list[PokaYokeDevice]:
        """Return all active devices that are past their verification date."""
        result = await db.execute(
            select(PokaYokeDevice).where(
                PokaYokeDevice.factory_id == factory_id,
                PokaYokeDevice.status == "active",
            )
        )
        devices = result.scalars().all()
        return [d for d in devices if PokaYokeService.is_overdue(d)]

    @staticmethod
    async def record_verification(
        db: AsyncSession,
        device: PokaYokeDevice,
        user_id: int,
        result_val: str,
        notes: str | None,
    ) -> PokaYokeVerification:
        """Record a verification and update device state."""
        now = datetime.now(timezone.utc)

        verification = PokaYokeVerification(
            device_id=device.id,
            factory_id=device.factory_id,
            verified_by_id=user_id,
            result=result_val,
            notes=notes,
            verified_at=now,
        )
        db.add(verification)

        # Update device last_verified_at
        device.last_verified_at = now

        # Update effectiveness rate (rolling average of last 20 verifications)
        ver_result = await db.execute(
            select(PokaYokeVerification)
            .where(PokaYokeVerification.device_id == device.id)
            .order_by(PokaYokeVerification.verified_at.desc())
            .limit(20)
        )
        recent = ver_result.scalars().all()
        # Include the new one (not yet flushed, so add manually)
        all_results = [result_val] + [v.result for v in recent]
        pass_count = sum(1 for r in all_results if r == "PASS")
        device.effectiveness_rate = round((pass_count / len(all_results)) * 100, 1)

        # If device failed, flag needs_repair
        if result_val == "FAIL":
            device.status = "needs_repair"

        await db.flush()
        await db.refresh(verification)
        return verification

    @staticmethod
    async def compute_stats(db: AsyncSession, factory_id: int) -> dict:
        """Compute dashboard statistics for poka-yoke devices."""
        result = await db.execute(
            select(PokaYokeDevice).where(PokaYokeDevice.factory_id == factory_id)
        )
        devices = result.scalars().all()

        total = len(devices)
        by_status: dict[str, int] = {}
        by_type: dict[str, int] = {}
        active_count = 0
        inactive_count = 0
        needs_repair_count = 0
        effectiveness_vals = []

        for d in devices:
            by_status[d.status] = by_status.get(d.status, 0) + 1
            by_type[d.device_type] = by_type.get(d.device_type, 0) + 1

            if d.status == "active":
                active_count += 1
            elif d.status == "inactive":
                inactive_count += 1
            elif d.status == "needs_repair":
                needs_repair_count += 1

            if d.effectiveness_rate is not None:
                effectiveness_vals.append(d.effectiveness_rate)

        overdue_devices = [d for d in devices if PokaYokeService.is_overdue(d)]
        avg_effectiveness = (
            round(sum(effectiveness_vals) / len(effectiveness_vals), 1)
            if effectiveness_vals else None
        )

        # Recent verifications
        ver_result = await db.execute(
            select(PokaYokeVerification)
            .where(PokaYokeVerification.factory_id == factory_id)
            .order_by(PokaYokeVerification.verified_at.desc())
            .limit(10)
        )
        recent_verifications = ver_result.scalars().all()

        return {
            "total_devices": total,
            "active_count": active_count,
            "inactive_count": inactive_count,
            "needs_repair_count": needs_repair_count,
            "overdue_count": len(overdue_devices),
            "avg_effectiveness": avg_effectiveness,
            "by_type": by_type,
            "by_status": by_status,
            "recent_verifications": recent_verifications,
        }
