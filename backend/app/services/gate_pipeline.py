"""Orchestrates Gate 1 → Gate 2 → Razorpay dispatch / Soft-Fail Queue."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.entities import (
    Agent,
    BankHealthSnapshot,
    Decision,
    DecisionOutcome,
    Intent,
    Organization,
    Policy,
    QueueJob,
    QueueStatus,
)
from app.services.audit import write_audit
from app.services.bank_health import bank_health_service
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_client import razorpay_client

policy_engine = PolicyEngine()


async def _spent_today(db: AsyncSession, org_id: UUID, exclude_intent_id: UUID | None = None) -> int:
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    clauses = [
        Intent.organization_id == org_id,
        Intent.created_at >= start,
        Intent.status.in_(
            [DecisionOutcome.ALLOW, DecisionOutcome.CLEARED, DecisionOutcome.QUEUED]
        ),
    ]
    if exclude_intent_id is not None:
        clauses.append(Intent.id != exclude_intent_id)
    q = await db.execute(
        select(func.coalesce(func.sum(Intent.amount_paise), 0)).where(*clauses)
    )
    return int(q.scalar_one())


async def _active_policy(db: AsyncSession, org_id: UUID) -> Policy | None:
    q = await db.execute(
        select(Policy)
        .where(Policy.organization_id == org_id, Policy.is_active.is_(True))
        .order_by(Policy.created_at.desc())
        .limit(1)
    )
    return q.scalar_one_or_none()


async def process_intent(
    db: AsyncSession,
    *,
    agent: Agent,
    organization: Organization,
    amount_paise: int,
    currency: str,
    sku: str,
    description: str | None = None,
    external_ref: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> Intent:
    intent = Intent(
        organization_id=organization.id,
        agent_id=agent.id,
        amount_paise=amount_paise,
        currency=currency.upper(),
        sku=sku,
        description=description,
        external_ref=external_ref,
        metadata_json=metadata or {},
        status=DecisionOutcome.ALLOW,
    )
    db.add(intent)
    await db.flush()

    # ---- Gate 1: Policy ----
    policy = await _active_policy(db, organization.id)
    if policy is None:
        # Create a permissive default so demos never soft-fail on missing seed
        policy = Policy(
            organization_id=organization.id,
            name="Default Guardrail",
            max_amount_paise=50_000_00,
            daily_budget_paise=200_000_00,
            sku_whitelist=[],
            sku_blacklist=["WEAPON", "GAMBLING", "CRYPTO_MIXER"],
            is_active=True,
        )
        db.add(policy)
        await db.flush()

    spent = await _spent_today(db, organization.id, exclude_intent_id=intent.id)
    verdict = policy_engine.evaluate(
        amount_paise=amount_paise,
        currency=currency,
        sku=sku,
        policy=policy,
        spent_today_paise=spent,
    )

    d1 = Decision(
        intent_id=intent.id,
        gate="gate1",
        outcome=DecisionOutcome.ALLOW if verdict.allowed else DecisionOutcome.HARD_BLOCK,
        reason_code=verdict.reason_code,
        reason_message=verdict.reason_message,
        details=verdict.details,
    )
    db.add(d1)

    if not verdict.allowed:
        intent.status = DecisionOutcome.HARD_BLOCK
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="intent.hard_block",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={"reason_code": verdict.reason_code, "sku": sku, "amount_paise": amount_paise},
        )
        await db.flush()
        return intent

    # ---- Gate 2: Bank Health ----
    health = await bank_health_service.check(threshold=organization.bank_health_threshold)
    snap = BankHealthSnapshot(
        provider=health.provider,
        success_rate=health.success_rate,
        latency_ms=health.latency_ms,
        is_degraded=health.is_degraded,
        details=health.details,
    )
    db.add(snap)

    d2 = Decision(
        intent_id=intent.id,
        gate="gate2",
        outcome=DecisionOutcome.QUEUED if health.is_degraded else DecisionOutcome.ALLOW,
        reason_code="BANK_DEGRADED" if health.is_degraded else "BANK_HEALTHY",
        reason_message=(
            f"Bank success rate {health.success_rate:.1%} below threshold {health.threshold:.1%}"
            if health.is_degraded
            else f"Bank success rate {health.success_rate:.1%} ≥ threshold {health.threshold:.1%}"
        ),
        details={
            "success_rate": health.success_rate,
            "threshold": health.threshold,
            "latency_ms": health.latency_ms,
            "is_degraded": health.is_degraded,
        },
    )
    db.add(d2)

    if health.is_degraded:
        intent.status = DecisionOutcome.QUEUED
        job = QueueJob(
            intent_id=intent.id,
            status=QueueStatus.PENDING,
            next_retry_at=datetime.now(timezone.utc) + timedelta(seconds=10),
        )
        db.add(job)
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="intent.queued",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={"success_rate": health.success_rate, "threshold": health.threshold},
        )
        await db.flush()
        return intent

    # ---- Razorpay dispatch ----
    order = await razorpay_client.create_order(
        amount_paise=amount_paise,
        currency=currency.upper(),
        receipt=str(intent.id)[:40],
        notes={"sku": sku, "agent_id": str(agent.id), "org": organization.slug},
    )

    if order.success:
        intent.status = DecisionOutcome.ALLOW
        intent.razorpay_order_id = order.order_id
        intent.razorpay_payment_id = order.payment_id
        db.add(
            Decision(
                intent_id=intent.id,
                gate="razorpay",
                outcome=DecisionOutcome.ALLOW,
                reason_code="PAYMENT_DISPATCHED",
                reason_message="Order created on Razorpay",
                details=order.raw or {},
            )
        )
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="intent.allowed",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={"order_id": order.order_id},
        )
    else:
        intent.status = DecisionOutcome.FAILED
        db.add(
            Decision(
                intent_id=intent.id,
                gate="razorpay",
                outcome=DecisionOutcome.FAILED,
                reason_code="RAZORPAY_ERROR",
                reason_message=order.error or "Unknown Razorpay error",
                details={},
            )
        )

    await db.flush()
    return intent


async def retry_queued_job(db: AsyncSession, job_id: UUID) -> QueueJob:
    """Attempt to clear a soft-fail queue job when bank health recovers."""
    q = await db.execute(
        select(QueueJob)
        .where(QueueJob.id == job_id)
        .options(selectinload(QueueJob.intent).selectinload(Intent.organization))
    )
    job = q.scalar_one()
    intent = job.intent
    org = intent.organization

    job.status = QueueStatus.PROCESSING
    job.attempts += 1
    await db.flush()

    health = await bank_health_service.check(threshold=org.bank_health_threshold)
    snap = BankHealthSnapshot(
        provider=health.provider,
        success_rate=health.success_rate,
        latency_ms=health.latency_ms,
        is_degraded=health.is_degraded,
        details={**health.details, "retry_for_job": str(job.id)},
    )
    db.add(snap)

    if health.is_degraded:
        job.status = QueueStatus.RETRYING if job.attempts < job.max_attempts else QueueStatus.FAILED
        job.last_error = f"Still degraded: {health.success_rate:.1%}"
        job.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=15 * job.attempts)
        if job.status == QueueStatus.FAILED:
            intent.status = DecisionOutcome.FAILED
            db.add(
                Decision(
                    intent_id=intent.id,
                    gate="gate2",
                    outcome=DecisionOutcome.FAILED,
                    reason_code="QUEUE_EXHAUSTED",
                    reason_message="Max retry attempts reached while bank rail degraded",
                    details={"attempts": job.attempts},
                )
            )
        await db.flush()
        return job

    order = await razorpay_client.create_order(
        amount_paise=intent.amount_paise,
        currency=intent.currency,
        receipt=str(intent.id)[:40],
        notes={"sku": intent.sku, "retry": True, "job_id": str(job.id)},
    )

    if order.success:
        job.status = QueueStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        job.last_error = None
        intent.status = DecisionOutcome.CLEARED
        intent.razorpay_order_id = order.order_id
        intent.razorpay_payment_id = order.payment_id
        db.add(
            Decision(
                intent_id=intent.id,
                gate="razorpay",
                outcome=DecisionOutcome.CLEARED,
                reason_code="QUEUE_CLEARED",
                reason_message="Soft-fail queue cleared; payment dispatched",
                details=order.raw or {},
            )
        )
        await write_audit(
            db,
            actor="system:worker",
            action="queue.cleared",
            organization_id=org.id,
            resource_type="queue_job",
            resource_id=str(job.id),
            payload={"order_id": order.order_id},
        )
    else:
        job.status = QueueStatus.RETRYING if job.attempts < job.max_attempts else QueueStatus.FAILED
        job.last_error = order.error
        job.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=15 * job.attempts)

    await db.flush()
    return job
