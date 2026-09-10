"""Razorpay payment integration (mock + live). Amounts always in paise."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Optional

from app.core.config import get_settings


@dataclass
class OrderResult:
    success: bool
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    error: Optional[str] = None
    raw: dict[str, Any] | None = None


class RazorpayClient:
    async def create_order(
        self,
        *,
        amount_paise: int,
        currency: str = "INR",
        receipt: str,
        notes: dict[str, Any] | None = None,
    ) -> OrderResult:
        settings = get_settings()
        if settings.razorpay_mock or not settings.razorpay_key_id:
            order_id = f"order_mock_{uuid.uuid4().hex[:16]}"
            payment_id = f"pay_mock_{uuid.uuid4().hex[:16]}"
            return OrderResult(
                success=True,
                order_id=order_id,
                payment_id=payment_id,
                raw={
                    "id": order_id,
                    "amount": amount_paise,
                    "currency": currency,
                    "receipt": receipt,
                    "status": "created",
                    "notes": notes or {},
                    "mock": True,
                },
            )

        try:
            import razorpay

            client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
            order = client.order.create(
                {
                    "amount": amount_paise,
                    "currency": currency,
                    "receipt": receipt,
                    "notes": notes or {},
                    "payment_capture": 1,
                }
            )
            return OrderResult(
                success=True,
                order_id=order.get("id"),
                raw=order,
            )
        except Exception as exc:  # noqa: BLE001
            return OrderResult(success=False, error=str(exc))


razorpay_client = RazorpayClient()
