"""Public metrics for ops / demo dashboards."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import DbSession
from app.models.entities import DecisionOutcome, Intent, QueueJob, QueueStatus
from app.services.bank_health import bank_health_service
from app.services.razorpay_client import is_mock_mode, razorpay_client

router = APIRouter(tags=["Public"])


@router.get("/public/metrics")
async def public_metrics(db: DbSession) -> dict[str, Any]:
    """JSON counters: intents by status, blocks, queue depth, bank + razorpay mode."""

    async def count_status(status: DecisionOutcome) -> int:
        r = await db.execute(select(func.count(Intent.id)).where(Intent.status == status))
        return int(r.scalar_one())

    total = int((await db.execute(select(func.count(Intent.id)))).scalar_one())
    by_status = {
        "ALLOW": await count_status(DecisionOutcome.ALLOW),
        "HARD_BLOCK": await count_status(DecisionOutcome.HARD_BLOCK),
        "QUEUED": await count_status(DecisionOutcome.QUEUED),
        "CLEARED": await count_status(DecisionOutcome.CLEARED),
        "FAILED": await count_status(DecisionOutcome.FAILED),
    }
    queue_pending = int(
        (
            await db.execute(
                select(func.count(QueueJob.id)).where(
                    QueueJob.status.in_(
                        [QueueStatus.PENDING, QueueStatus.RETRYING, QueueStatus.PROCESSING]
                    )
                )
            )
        ).scalar_one()
    )
    health = await bank_health_service.check()
    rz = razorpay_client.get_status()

    return {
        "service": "sentinel-ap",
        "version": "1.2.0",
        "intents": {"total": total, "by_status": by_status},
        "blocks": by_status["HARD_BLOCK"],
        "queue_depth": queue_pending,
        "bank": {
            "success_rate": health.success_rate,
            "is_degraded": health.is_degraded,
            "threshold": health.threshold,
        },
        "razorpay": {
            "mode": rz.mode,
            "mock": is_mock_mode(),
            "keys_configured": rz.keys_configured,
        },
    }


@router.get("/metrics")
async def metrics_alias(db: DbSession) -> dict[str, Any]:
    """Alias for scrapers expecting /api/v1/metrics."""
    return await public_metrics(db)
