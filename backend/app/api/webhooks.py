"""Razorpay webhook receiver — payment.captured updates intent payment_id/status."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession
from app.core.config import get_settings
from app.middleware.request_id import get_request_id
from app.models.entities import Decision, DecisionOutcome, Intent
from app.services.audit import write_audit
from app.services.intent_fsm import InvalidTransition, mark_payment_verified

logger = logging.getLogger("sentinel-ap.webhooks")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _verify_webhook_signature(body: bytes, signature: str | None, secret: str) -> bool:
    if not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    db: DbSession,
    x_razorpay_signature: str | None = Header(default=None, alias="X-Razorpay-Signature"),
) -> dict[str, Any]:
    """
    Handle Razorpay webhooks (test-mode friendly).

    Set `RAZORPAY_WEBHOOK_SECRET` to enforce HMAC verification.
    If unset, verification is skipped with a clear warning log (demo/test only).
    """
    settings = get_settings()
    raw = await request.body()
    secret = (settings.razorpay_webhook_secret or "").strip()

    if secret:
        if not _verify_webhook_signature(raw, x_razorpay_signature, secret):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        logger.warning(
            "RAZORPAY_WEBHOOK_SECRET unset — skipping signature verify (test/demo only) request_id=%s",
            get_request_id(request),
        )

    try:
        payload = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    event = payload.get("event") or ""
    entity = (
        ((payload.get("payload") or {}).get("payment") or {}).get("entity")
        or {}
    )
    payment_id = entity.get("id")
    order_id = entity.get("order_id")
    status = entity.get("status")

    request_id = get_request_id(request)
    logger.info(
        "webhook event=%s payment=%s order=%s status=%s request_id=%s",
        event,
        payment_id,
        order_id,
        status,
        request_id,
    )

    if event != "payment.captured" or not order_id:
        return {
            "ok": True,
            "handled": False,
            "event": event,
            "reason": "ignored_event_or_missing_order",
            "request_id": request_id,
        }

    q = await db.execute(
        select(Intent)
        .where(Intent.razorpay_order_id == order_id)
        .options(selectinload(Intent.decisions))
    )
    intent = q.scalar_one_or_none()
    if not intent:
        return {
            "ok": True,
            "handled": False,
            "event": event,
            "reason": "intent_not_found",
            "order_id": order_id,
            "request_id": request_id,
        }

    # Idempotent if already recorded
    if intent.razorpay_payment_id and payment_id and intent.razorpay_payment_id == payment_id:
        return {
            "ok": True,
            "handled": True,
            "idempotent": True,
            "intent_id": str(intent.id),
            "request_id": request_id,
        }

    if payment_id:
        intent.razorpay_payment_id = payment_id

    try:
        mark_payment_verified(intent, via="webhook_payment_captured")
        fsm_state = "VERIFIED"
    except InvalidTransition:
        # Intent may still be QUEUED/FAILED; record capture without forcing FSM
        fsm_state = intent.status.value if hasattr(intent.status, "value") else str(intent.status)

    db.add(
        Decision(
            intent_id=intent.id,
            gate="razorpay",
            outcome=intent.status if intent.status in (DecisionOutcome.ALLOW, DecisionOutcome.CLEARED) else DecisionOutcome.ALLOW,
            reason_code="WEBHOOK_PAYMENT_CAPTURED",
            reason_message="payment.captured webhook received",
            details={
                "payment_id": payment_id,
                "order_id": order_id,
                "status": status,
                "event": event,
                "request_id": request_id,
                "received_at": datetime.now(timezone.utc).isoformat(),
                "fsm_state": fsm_state,
            },
        )
    )
    await write_audit(
        db,
        actor="system:webhook",
        action="razorpay.webhook_payment_captured",
        organization_id=intent.organization_id,
        resource_type="intent",
        resource_id=str(intent.id),
        payload={
            "payment_id": payment_id,
            "order_id": order_id,
            "event": event,
            "request_id": request_id,
        },
    )
    await db.flush()

    return {
        "ok": True,
        "handled": True,
        "intent_id": str(intent.id),
        "payment_id": payment_id,
        "order_id": order_id,
        "request_id": request_id,
    }
