"""Orchestrates Gate 1 → Gate 2 → Razorpay dispatch / Soft-Fail Queue.

Transactional boundary: all Decision rows + Intent.status + QueueJob + audit for a
single intent path are flushed on the same AsyncSession; the request-scoped
get_db() dependency commits once at the end (unit of work).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging_utils import structured_log
from app.domain.decisions import PaymentDispatch, PipelineResult, PolicyDecision
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
from app.services.intent_fsm import IntentState, apply_transition
from app.services.policy_engine import PolicyEngine
from app.services.razorpay_client import razorpay_client

policy_engine = PolicyEngine()
logger = logging.getLogger("sentinel-ap.pipeline")


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


def _policy_decision_from_verdict(verdict) -> PolicyDecision:
    return PolicyDecision(
        allowed=verdict.allowed,
        reason_code=verdict.reason_code or ("POLICY_PASS" if verdict.allowed else "POLICY_DENIED"),
        reason_message=verdict.reason_message or "",
        details=verdict.details or {},
    )


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
    request_id = (metadata or {}).get("request_id")
    # PENDING: create intent row; status overwritten by FSM on first gate outcome
    intent = Intent(
        organization_id=organization.id,
        agent_id=agent.id,
        amount_paise=amount_paise,
        currency=currency.upper(),
        sku=sku,
        description=description,
        external_ref=external_ref,
        metadata_json=metadata or {},
        status=DecisionOutcome.ALLOW,  # placeholder until FSM applies; never returned as PENDING
    )
    db.add(intent)
    await db.flush()

    structured_log(
        logger,
        logging.INFO,
        "intent.pending",
        request_id=request_id,
        intent_id=str(intent.id),
        gate="ingress",
        outcome="PENDING",
        sku=sku,
        amount_paise=amount_paise,
    )

    # ---- Gate 1: Policy ----
    policy = await _active_policy(db, organization.id)
    if policy is None:
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
    policy_decision = _policy_decision_from_verdict(verdict)

    d1 = Decision(
        intent_id=intent.id,
        gate="gate1",
        outcome=DecisionOutcome.ALLOW if policy_decision.allowed else DecisionOutcome.HARD_BLOCK,
        reason_code=policy_decision.reason_code,
        reason_message=policy_decision.reason_message,
        details=policy_decision.details,
    )
    db.add(d1)

    if not policy_decision.allowed:
        apply_transition(intent, IntentState.HARD_BLOCK, via="gate1_fail", from_pending=True)
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="intent.hard_block",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={
                "reason_code": policy_decision.reason_code,
                "sku": sku,
                "amount_paise": amount_paise,
                "request_id": request_id,
            },
        )
        structured_log(
            logger,
            logging.INFO,
            "gate1.hard_block",
            request_id=request_id,
            intent_id=str(intent.id),
            gate="gate1",
            outcome="HARD_BLOCK",
            reason_code=policy_decision.reason_code,
        )
        await db.flush()
        return intent

    # ---- Gate 2: Bank Health ----
    health_result = await bank_health_service.check(threshold=organization.bank_health_threshold)
    health_decision = health_result.to_decision()
    snap = BankHealthSnapshot(
        provider=health_result.provider,
        success_rate=health_result.success_rate,
        latency_ms=health_result.latency_ms,
        is_degraded=health_result.is_degraded,
        details=health_result.details,
    )
    db.add(snap)

    d2 = Decision(
        intent_id=intent.id,
        gate="gate2",
        outcome=DecisionOutcome.QUEUED if health_decision.is_degraded else DecisionOutcome.ALLOW,
        reason_code=health_decision.reason_code,
        reason_message=health_decision.reason_message,
        details={
            **health_decision.details,
            "success_rate": health_decision.success_rate,
            "threshold": health_decision.threshold,
            "latency_ms": health_decision.latency_ms,
            "from_cache": health_decision.from_cache,
        },
    )
    db.add(d2)

    if health_decision.is_degraded:
        apply_transition(intent, IntentState.QUEUED, via="gate2_degraded", from_pending=True)
        # Durable outbox-style queue job (works without ARQ worker)
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
            payload={
                "success_rate": health_decision.success_rate,
                "threshold": health_decision.threshold,
                "request_id": request_id,
                "queue_status": QueueStatus.PENDING.value,
            },
        )
        structured_log(
            logger,
            logging.INFO,
            "gate2.queued",
            request_id=request_id,
            intent_id=str(intent.id),
            gate="gate2",
            outcome="QUEUED",
            reason_code=health_decision.reason_code,
        )
        await db.flush()
        return intent

    # ---- Razorpay dispatch (execution plane) ----
    order = await razorpay_client.create_order(
        amount_paise=amount_paise,
        currency=currency.upper(),
        receipt=str(intent.id)[:40],
        notes={"sku": sku, "agent_id": str(agent.id), "org": organization.slug},
    )
    mock_flag = bool(getattr(order, "mock", False) or (order.order_id or "").startswith("order_mock_"))
    payment = PaymentDispatch(
        success=bool(order.success),
        order_id=order.order_id,
        payment_id=order.payment_id,
        mock=mock_flag,
        error=order.error,
        raw=order.raw or {},
    )

    if payment.success:
        apply_transition(intent, IntentState.ALLOW, via="razorpay_order_ok", from_pending=True)
        intent.razorpay_order_id = payment.order_id
        intent.razorpay_payment_id = payment.payment_id
        reason_msg = (
            "Mock Razorpay order created (RAZORPAY_MOCK)"
            if payment.mock
            else "Live Razorpay Order created — awaiting Checkout payment + signature verify"
        )
        db.add(
            Decision(
                intent_id=intent.id,
                gate="razorpay",
                outcome=DecisionOutcome.ALLOW,
                reason_code=payment.reason_code,
                reason_message=reason_msg,
                details={**(payment.raw or {}), "mock": payment.mock},
            )
        )
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="razorpay.order_created" if not payment.mock else "intent.allowed",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={
                "order_id": payment.order_id,
                "mock": payment.mock,
                "amount_paise": amount_paise,
                "currency": currency.upper(),
                "sku": sku,
                "gate": "razorpay",
                "request_id": request_id,
            },
        )
        structured_log(
            logger,
            logging.INFO,
            "razorpay.order_created",
            request_id=request_id,
            intent_id=str(intent.id),
            gate="razorpay",
            outcome="ALLOW",
            reason_code=payment.reason_code,
            order_id=payment.order_id,
        )
    else:
        apply_transition(intent, IntentState.FAILED, via="razorpay_order_error", from_pending=True)
        db.add(
            Decision(
                intent_id=intent.id,
                gate="razorpay",
                outcome=DecisionOutcome.FAILED,
                reason_code="RAZORPAY_ERROR",
                reason_message=payment.error or "Unknown Razorpay error",
                details={},
            )
        )
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="razorpay.order_failed",
            organization_id=organization.id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={"error": payment.error, "sku": sku, "amount_paise": amount_paise, "request_id": request_id},
        )
        structured_log(
            logger,
            logging.WARNING,
            "razorpay.order_failed",
            request_id=request_id,
            intent_id=str(intent.id),
            gate="razorpay",
            outcome="FAILED",
            reason_code="RAZORPAY_ERROR",
            error=payment.error,
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
            apply_transition(intent, IntentState.FAILED, via="queue_exhausted")
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
        else:
            # remain QUEUED
            apply_transition(intent, IntentState.QUEUED, via="queue_retry_still_degraded")
        structured_log(
            logger,
            logging.INFO,
            "queue.retry_degraded",
            intent_id=str(intent.id),
            gate="gate2",
            outcome=intent.status.value,
            reason_code="BANK_DEGRADED",
            job_id=str(job.id),
            attempts=job.attempts,
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
        apply_transition(intent, IntentState.CLEARED, via="queue_retry_success")
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
        structured_log(
            logger,
            logging.INFO,
            "queue.cleared",
            intent_id=str(intent.id),
            gate="razorpay",
            outcome="CLEARED",
            reason_code="QUEUE_CLEARED",
            job_id=str(job.id),
        )
    else:
        job.status = QueueStatus.RETRYING if job.attempts < job.max_attempts else QueueStatus.FAILED
        job.last_error = order.error
        job.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=15 * job.attempts)
        if job.status == QueueStatus.FAILED:
            apply_transition(intent, IntentState.FAILED, via="queue_dispatch_failed")
        structured_log(
            logger,
            logging.WARNING,
            "queue.retry_failed",
            intent_id=str(intent.id),
            gate="razorpay",
            outcome=job.status.value,
            reason_code="RAZORPAY_ERROR",
            job_id=str(job.id),
            error=order.error,
        )

    await db.flush()
    return job


async def drain_due_jobs(db: AsyncSession, *, limit: int = 20) -> list[QueueJob]:
    """Process due PENDING/RETRYING queue jobs (admin drain / outbox pump)."""
    now = datetime.now(timezone.utc)
    q = await db.execute(
        select(QueueJob)
        .where(
            QueueJob.status.in_([QueueStatus.PENDING, QueueStatus.RETRYING]),
            (QueueJob.next_retry_at.is_(None)) | (QueueJob.next_retry_at <= now),
        )
        .order_by(QueueJob.created_at.asc())
        .limit(limit)
    )
    jobs = list(q.scalars().all())
    results: list[QueueJob] = []
    for job in jobs:
        try:
            results.append(await retry_queued_job(db, job.id))
        except Exception:  # noqa: BLE001
            logger.exception("drain failed for job %s", job.id)
    return results
