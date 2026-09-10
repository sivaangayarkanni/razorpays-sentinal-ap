"""Agent-facing intent API with Idempotency-Key support."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AgentDep, DbSession
from app.core.rate_limit import intent_limiter
from app.middleware.request_id import get_request_id
from app.models.entities import IdempotencyRecord, Intent
from app.schemas.api import IntentCreate, IntentResponse, DecisionOut
from app.services.audit import write_audit
from app.services.gate_pipeline import process_intent

router = APIRouter(
    prefix="/agent",
    tags=["Agent"],
)


def _intent_to_response(intent: Intent, *, idempotent: bool = False) -> IntentResponse:
    queue_job_id = intent.queue_jobs[0].id if intent.queue_jobs else None
    messages = {
        "ALLOW": "Passed Gate 1 & Gate 2 — Razorpay order created (complete Checkout to pay)",
        "HARD_BLOCK": "Hard blocked by Gate 1 policy guardrail",
        "QUEUED": "Soft-fail queued — bank rail degraded; will retry safely",
        "CLEARED": "Previously queued intent cleared",
        "FAILED": "Processing failed",
    }
    status = intent.status.value if hasattr(intent.status, "value") else str(intent.status)
    msg = messages.get(status, status)
    if idempotent:
        msg = f"[idempotent] {msg}"
    return IntentResponse(
        id=intent.id,
        status=status,
        amount_paise=intent.amount_paise,
        currency=intent.currency,
        sku=intent.sku,
        description=intent.description,
        external_ref=intent.external_ref,
        razorpay_order_id=intent.razorpay_order_id,
        razorpay_payment_id=intent.razorpay_payment_id,
        decisions=[
            DecisionOut(
                gate=d.gate,
                outcome=d.outcome.value if hasattr(d.outcome, "value") else str(d.outcome),
                reason_code=d.reason_code,
                reason_message=d.reason_message,
                details=d.details or {},
                created_at=d.created_at,
            )
            for d in sorted(intent.decisions, key=lambda x: x.created_at)
        ],
        queue_job_id=queue_job_id,
        message=msg,
        created_at=intent.created_at,
    )


async def _load_intent(db, intent_id: UUID) -> Intent:
    q = await db.execute(
        select(Intent)
        .where(Intent.id == intent_id)
        .options(selectinload(Intent.decisions), selectinload(Intent.queue_jobs))
    )
    return q.scalar_one()


@router.post(
    "/intents",
    response_model=IntentResponse,
    summary="Submit payment intent",
    description=(
        "Run Gate 1 (policy) → Gate 2 (bank health) → Razorpay Order. "
        "Pass `Idempotency-Key` to safely retry; duplicates return the same intent."
    ),
)
async def create_intent(
    body: IntentCreate,
    agent: AgentDep,
    db: DbSession,
    request: Request,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
) -> IntentResponse:
    api_key = request.headers.get("X-API-Key") or ""
    rl_key = api_key[:20] if api_key else (request.client.host if request.client else "anon")
    if not intent_limiter.allow(rl_key):
        raise HTTPException(
            status_code=429,
            detail={"error": "rate_limited", "message": "Rate limit exceeded — try again shortly"},
        )

    request_id = get_request_id(request)
    key = (idempotency_key or "").strip()[:255] or None

    if key:
        existing = (
            await db.execute(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.agent_id == agent.id,
                    IdempotencyRecord.key == key,
                )
            )
        ).scalar_one_or_none()
        if existing:
            intent = await _load_intent(db, existing.intent_id)
            return _intent_to_response(intent, idempotent=True)

    intent = await process_intent(
        db,
        agent=agent,
        organization=agent.organization,
        amount_paise=body.amount_paise,
        currency=body.currency,
        sku=body.sku,
        description=body.description,
        external_ref=body.external_ref,
        metadata={**(body.metadata or {}), **({"request_id": request_id} if request_id else {})},
    )

    if key:
        db.add(
            IdempotencyRecord(
                agent_id=agent.id,
                key=key,
                intent_id=intent.id,
            )
        )
        await write_audit(
            db,
            actor=f"agent:{agent.id}",
            action="intent.idempotency_recorded",
            organization_id=agent.organization_id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={"idempotency_key": key, "request_id": request_id},
        )
        await db.flush()

    intent = await _load_intent(db, intent.id)
    return _intent_to_response(intent)


@router.get(
    "/intents/{intent_id}",
    response_model=IntentResponse,
    summary="Fetch intent by id",
)
async def get_intent(intent_id: UUID, agent: AgentDep, db: DbSession) -> IntentResponse:
    q = await db.execute(
        select(Intent)
        .where(Intent.id == intent_id, Intent.agent_id == agent.id)
        .options(selectinload(Intent.decisions), selectinload(Intent.queue_jobs))
    )
    intent = q.scalar_one_or_none()
    if not intent:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Intent not found"})
    return _intent_to_response(intent)
