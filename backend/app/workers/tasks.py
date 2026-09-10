"""ARQ background worker — soft-fail queue retries."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.entities import QueueJob, QueueStatus
from app.services.gate_pipeline import retry_queued_job

logger = logging.getLogger("sentinel-ap.worker")


async def process_soft_fail_queue(ctx: dict) -> int:
    """Pick pending/retrying jobs whose next_retry_at has passed."""
    now = datetime.now(timezone.utc)
    processed = 0
    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(QueueJob)
            .where(
                QueueJob.status.in_([QueueStatus.PENDING, QueueStatus.RETRYING]),
                (QueueJob.next_retry_at.is_(None)) | (QueueJob.next_retry_at <= now),
            )
            .options(selectinload(QueueJob.intent))
            .limit(20)
        )
        jobs = list(q.scalars().all())
        for job in jobs:
            try:
                await retry_queued_job(db, job.id)
                processed += 1
            except Exception:  # noqa: BLE001
                logger.exception("Failed processing job %s", job.id)
        await db.commit()
    logger.info("Processed %s queue jobs", processed)
    return processed


async def startup(ctx: dict) -> None:
    logger.info("Sentinel-AP worker started")


async def shutdown(ctx: dict) -> None:
    logger.info("Sentinel-AP worker stopped")


class WorkerSettings:
    functions = [process_soft_fail_queue]
    cron_jobs = [cron(process_soft_fail_queue, second={0, 15, 30, 45})]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
