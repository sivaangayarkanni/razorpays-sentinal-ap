"""Razorpay payment integration (mock + live test/live keys). Amounts always in paise.

Uses httpx + HMAC so we do not depend on the razorpay SDK's pkg_resources import
(broken on newer setuptools / slim Python images).
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.core.config import get_settings

RAZORPAY_API = "https://api.razorpay.com/v1"


@dataclass
class OrderResult:
    success: bool
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    error: Optional[str] = None
    raw: dict[str, Any] | None = None
    mock: bool = False


@dataclass
class VerifyResult:
    success: bool
    error: Optional[str] = None


@dataclass
class RazorpayStatus:
    mode: str  # mock | test | live
    key_id_prefix: str
    mock: bool
    keys_configured: bool
    last_probe_at: Optional[str] = None
    last_probe_ok: Optional[bool] = None
    last_probe_detail: Optional[str] = None


_last_probe: dict[str, Any] = {
    "at": None,
    "ok": None,
    "detail": None,
}


def api_mode_from_key(key_id: str) -> str:
    if not key_id:
        return "mock"
    if key_id.startswith("rzp_live_") or key_id.startswith("zp_live_"):
        return "live"
    if key_id.startswith("rzp_test_") or key_id.startswith("zp_test_"):
        return "test"
    return "unknown"


def is_mock_mode() -> bool:
    settings = get_settings()
    return bool(settings.razorpay_mock or not settings.razorpay_key_id or not settings.razorpay_key_secret)


def _auth() -> tuple[str, str]:
    settings = get_settings()
    return settings.razorpay_key_id, settings.razorpay_key_secret


def _record_probe(ok: bool, detail: str) -> None:
    _last_probe["at"] = datetime.now(timezone.utc).isoformat()
    _last_probe["ok"] = ok
    _last_probe["detail"] = detail[:200]


class RazorpayClient:
    async def create_order(
        self,
        *,
        amount_paise: int,
        currency: str = "INR",
        receipt: str,
        notes: dict[str, Any] | None = None,
    ) -> OrderResult:
        if is_mock_mode():
            order_id = f"order_mock_{uuid.uuid4().hex[:16]}"
            payment_id = f"pay_mock_{uuid.uuid4().hex[:16]}"
            return OrderResult(
                success=True,
                order_id=order_id,
                payment_id=payment_id,
                mock=True,
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

        payload = {
            "amount": int(amount_paise),
            "currency": currency,
            "receipt": receipt[:40],
            "notes": notes or {},
            "payment_capture": 1,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{RAZORPAY_API}/orders",
                    json=payload,
                    auth=_auth(),
                )
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                err = (data.get("error") or {}).get("description") or resp.text[:200]
                _record_probe(False, f"create_order http={resp.status_code}: {err}")
                return OrderResult(success=False, error=err, mock=False, raw=data if isinstance(data, dict) else None)
            order_id = data.get("id")
            _record_probe(True, f"create_order ok id={order_id}")
            return OrderResult(
                success=True,
                order_id=order_id,
                payment_id=None,
                mock=False,
                raw=data,
            )
        except Exception as exc:  # noqa: BLE001
            _record_probe(False, f"create_order error: {exc}")
            return OrderResult(success=False, error=str(exc), mock=False)

    def verify_payment_signature(
        self,
        *,
        order_id: str,
        payment_id: str,
        signature: str,
    ) -> VerifyResult:
        """Verify Razorpay Checkout success callback signature (HMAC-SHA256)."""
        if is_mock_mode():
            if order_id.startswith("order_mock_") and payment_id.startswith("pay_mock_"):
                return VerifyResult(success=True)
            if signature == "mock_signature":
                return VerifyResult(success=True)
            return VerifyResult(success=False, error="Invalid mock signature")

        settings = get_settings()
        message = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(
            settings.razorpay_key_secret.encode(),
            message,
            hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(expected, signature):
            return VerifyResult(success=True)
        # Also try razorpay utility if available (optional)
        try:
            import razorpay

            client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
            client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": order_id,
                    "razorpay_payment_id": payment_id,
                    "razorpay_signature": signature,
                }
            )
            return VerifyResult(success=True)
        except Exception:
            pass
        return VerifyResult(success=False, error="Invalid payment signature")

    async def fetch_order(self, order_id: str) -> dict[str, Any]:
        """Fetch order status from Razorpay (or mock stub)."""
        if is_mock_mode() or order_id.startswith("order_mock_"):
            return {"id": order_id, "status": "created", "mock": True}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{RAZORPAY_API}/orders/{order_id}", auth=_auth())
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                err = (data.get("error") or {}).get("description") or resp.text[:200]
                _record_probe(False, f"fetch_order error: {err}")
                raise RuntimeError(err)
            _record_probe(True, f"fetch_order ok id={order_id}")
            return data if isinstance(data, dict) else {"raw": data}
        except Exception as exc:  # noqa: BLE001
            _record_probe(False, f"fetch_order error: {exc}")
            raise

    def get_status(self) -> RazorpayStatus:
        settings = get_settings()
        mock = is_mock_mode()
        key = settings.razorpay_key_id or ""
        mode = "mock" if mock else api_mode_from_key(key)
        prefix = ""
        if key:
            prefix = key[:12] + "…" if len(key) > 12 else key[:8] + "…"
        return RazorpayStatus(
            mode=mode,
            key_id_prefix=prefix,
            mock=mock,
            keys_configured=bool(settings.razorpay_key_id and settings.razorpay_key_secret),
            last_probe_at=_last_probe.get("at"),
            last_probe_ok=_last_probe.get("ok"),
            last_probe_detail=_last_probe.get("detail"),
        )


razorpay_client = RazorpayClient()
