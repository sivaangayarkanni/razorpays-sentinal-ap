"""Agent-facing intent API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.api.deps import AgentDep, DbSession
from app.core.rate_limit import intent_limiter
from app.models.entities import Intent
from app.schemas.api import IntentCreate, IntentResponse, DecisionOut
from app.services.gate_pipeline import process_intent

router = APIRouter(prefix="/agent", tags=["Agent"])


@router.post("/intents", response_model=IntentResponse)
async def create_intent(
    body: IntentCreate,
    agent: AgentDep,
    db: DbSession,
    request: Request,
) -> IntentResponse:
    # Light in-memory rate limit (per API key; falls back to client host)
    api_key = request.headers.get("X-API-Key") or ""
    rl_key = api_key[:20] if api_key else (request.client.host if request.client else "anon")
    if not intent_limiter.allow(rl_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded — try again shortly")

    intent = await process_intent(
        db,
        agent=agent,
        organization=agent.organization,
        amount_paise=body.amount_paise,
        currency=body.currency,
        sku=body.sku,
        description=body.description,
        external_ref=body.external_ref,
        metadata=body.metadata,
    )
    # reload with decisions
    q = await db.execute(
        select(Intent)
        .where(Intent.id == intent.id)
        .options(selectinload(Intent.decisions), selectinload(Intent.queue_jobs))
    )
    intent = q.scalar_one()

    queue_job_id = intent.queue_jobs[0].id if intent.queue_jobs else None
    messages = {
        "ALLOW": "Passed Gate 1 & Gate 2 — Razorpay order created (complete Checkout to pay)",
        "HARD_BLOCK": "Hard blocked by Gate 1 policy guardrail",
        "QUEUED": "Soft-fail queued — bank rail degraded; will retry safely",
        "CLEARED": "Previously queued intent cleared",
        "FAILED": "Processing failed",
    }
    status = intent.status.value if hasattr(intent.status, "value") else str(intent.status)

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
        message=messages.get(status, status),
        created_at=intent.created_at,
    )
