"""Payment verification + public Razorpay config."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminDep, DbSession, get_agent_from_api_key
from app.core.security import decode_access_token
from app.models.entities import Decision, DecisionOutcome, Intent
from app.services.audit import write_audit
from app.services.razorpay_client import api_mode_from_key, is_mock_mode, razorpay_client
from app.core.config import get_settings

router = APIRouter(tags=["Payments"])
bearer = HTTPBearer(auto_error=False)


class PaymentVerifyRequest(BaseModel):
    intent_id: UUID
    razorpay_order_id: str = Field(..., min_length=1)
    razorpay_payment_id: str = Field(..., min_length=1)
    razorpay_signature: str = Field(..., min_length=1)


class PaymentVerifyResponse(BaseModel):
    success: bool
    intent_id: UUID
    status: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    message: str


class PublicConfigResponse(BaseModel):
    razorpay_key_id: str
    mock: bool
    api_mode: str  # mock | test | live | unknown


class RazorpayAdminStatus(BaseModel):
    mode: str
    key_id_prefix: str
    mock: bool
    keys_configured: bool
    last_probe_at: Optional[str] = None
    last_probe_ok: Optional[bool] = None
    last_probe_detail: Optional[str] = None


async def _require_admin_or_agent(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
):
    """Accept either admin JWT or agent API key."""
    if credentials is not None:
        payload = decode_access_token(credentials.credentials)
        if payload and payload.get("role") == "admin":
            return {"kind": "admin", "actor": f"admin:{payload.get('sub')}"}
    if x_api_key:
        agent = await get_agent_from_api_key(db, x_api_key)
        return {"kind": "agent", "actor": f"agent:{agent.id}", "agent": agent}
    raise HTTPException(status_code=401, detail="Admin Bearer token or X-API-Key required")


@router.get("/public/config", response_model=PublicConfigResponse)
async def public_config() -> PublicConfigResponse:
    """Expose public Razorpay key id for Checkout.js (never the secret)."""
    settings = get_settings()
    mock = is_mock_mode()
    key_id = "" if mock else (settings.razorpay_key_id or "")
    mode = "mock" if mock else api_mode_from_key(key_id)
    return PublicConfigResponse(
        razorpay_key_id=key_id,
        mock=mock,
        api_mode=mode,
    )


@router.post("/payments/verify", response_model=PaymentVerifyResponse)
async def verify_payment(
    body: PaymentVerifyRequest,
    db: DbSession,
    auth=Depends(_require_admin_or_agent),
) -> PaymentVerifyResponse:
    q = await db.execute(
        select(Intent)
        .where(Intent.id == body.intent_id)
        .options(selectinload(Intent.decisions))
    )
    intent = q.scalar_one_or_none()
    if not intent:
        raise HTTPException(status_code=404, detail="Intent not found")

    if intent.razorpay_order_id and intent.razorpay_order_id != body.razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="Order ID does not match intent",
        )

    # If already verified with same payment, idempotent success
    if intent.razorpay_payment_id == body.razorpay_payment_id and not body.razorpay_payment_id.startswith(
        "pay_mock_"
    ):
        st = intent.status.value if hasattr(intent.status, "value") else str(intent.status)
        return PaymentVerifyResponse(
            success=True,
            intent_id=intent.id,
            status=st,
            razorpay_order_id=intent.razorpay_order_id,
            razorpay_payment_id=intent.razorpay_payment_id,
            message="Payment already verified",
        )

    result = razorpay_client.verify_payment_signature(
        order_id=body.razorpay_order_id,
        payment_id=body.razorpay_payment_id,
        signature=body.razorpay_signature,
    )
    if not result.success:
        await write_audit(
            db,
            actor=auth["actor"],
            action="razorpay.verify_failed",
            organization_id=intent.organization_id,
            resource_type="intent",
            resource_id=str(intent.id),
            payload={
                "order_id": body.razorpay_order_id,
                "payment_id": body.razorpay_payment_id,
                "error": result.error,
            },
        )
        await db.flush()
        raise HTTPException(status_code=400, detail=result.error or "Signature verification failed")

    intent.razorpay_order_id = body.razorpay_order_id
    intent.razorpay_payment_id = body.razorpay_payment_id
    db.add(
        Decision(
            intent_id=intent.id,
            gate="razorpay",
            outcome=DecisionOutcome.ALLOW,
            reason_code="PAYMENT_VERIFIED",
            reason_message="Checkout signature verified; payment captured",
            details={
                "razorpay_order_id": body.razorpay_order_id,
                "razorpay_payment_id": body.razorpay_payment_id,
                "verified_at": datetime.now(timezone.utc).isoformat(),
            },
        )
    )
    await write_audit(
        db,
        actor=auth["actor"],
        action="razorpay.payment_verified",
        organization_id=intent.organization_id,
        resource_type="intent",
        resource_id=str(intent.id),
        payload={
            "order_id": body.razorpay_order_id,
            "payment_id": body.razorpay_payment_id,
        },
    )
    await db.flush()
    st = intent.status.value if hasattr(intent.status, "value") else str(intent.status)
    return PaymentVerifyResponse(
        success=True,
        intent_id=intent.id,
        status=st,
        razorpay_order_id=intent.razorpay_order_id,
        razorpay_payment_id=intent.razorpay_payment_id,
        message="Payment verified successfully",
    )


@router.get("/admin/razorpay/status", response_model=RazorpayAdminStatus)
async def razorpay_status(_: AdminDep) -> RazorpayAdminStatus:
    s = razorpay_client.get_status()
    return RazorpayAdminStatus(
        mode=s.mode,
        key_id_prefix=s.key_id_prefix,
        mock=s.mock,
        keys_configured=s.keys_configured,
        last_probe_at=s.last_probe_at,
        last_probe_ok=s.last_probe_ok,
        last_probe_detail=s.last_probe_detail,
    )
