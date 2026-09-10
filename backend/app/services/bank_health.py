"""Gate 2 — Payment Rail & Bank Uptime Guardrail."""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings
from app.services.razorpay_client import is_mock_mode, _record_probe


@dataclass
class BankHealthResult:
    provider: str
    success_rate: float
    latency_ms: int
    is_degraded: bool
    threshold: float
    details: dict[str, Any] = field(default_factory=dict)


class BankHealthService:
    """Pre-flight bank health ping. Mockable for demos; pluggable for live Razorpay."""

    def __init__(self) -> None:
        self._forced_rate: float | None = None

    def set_mock_success_rate(self, rate: float) -> None:
        """Demo control: force a success rate (0.0–1.0)."""
        self._forced_rate = max(0.0, min(1.0, rate))

    def clear_forced_rate(self) -> None:
        self._forced_rate = None

    async def check(self, threshold: float | None = None) -> BankHealthResult:
        settings = get_settings()
        thr = threshold if threshold is not None else settings.bank_health_threshold
        start = time.perf_counter()

        if self._forced_rate is not None:
            success_rate = self._forced_rate
            details = {"mode": "forced", "note": "Demo override active"}
        elif is_mock_mode():
            # Simulate slight jitter around configured mock rate
            base = settings.bank_health_mock_success_rate
            jitter = random.uniform(-0.01, 0.01)
            success_rate = max(0.0, min(1.0, base + jitter))
            details = {"mode": "mock", "base_rate": base}
        else:
            # Lightweight live probe: hit Razorpay payments endpoint with limit=1
            success_rate, details = await self._live_probe()

        latency_ms = int((time.perf_counter() - start) * 1000)
        is_degraded = success_rate < thr

        return BankHealthResult(
            provider="razorpay",
            success_rate=round(success_rate, 4),
            latency_ms=latency_ms,
            is_degraded=is_degraded,
            threshold=thr,
            details=details,
        )

    async def _live_probe(self) -> tuple[float, dict[str, Any]]:
        import httpx

        settings = get_settings()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.razorpay.com/v1/payments",
                    params={"count": 1},
                    auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
                )
                if resp.status_code < 500:
                    _record_probe(True, f"bank_health probe http={resp.status_code}")
                    return 0.99, {"mode": "live", "http_status": resp.status_code}
                _record_probe(False, f"bank_health probe http={resp.status_code}")
                return 0.5, {"mode": "live", "http_status": resp.status_code, "error": "upstream_5xx"}
        except Exception as exc:  # noqa: BLE001
            _record_probe(False, f"bank_health probe error: {exc}")
            return 0.0, {"mode": "live", "error": str(exc)}


# Singleton for demo overrides shared across requests / worker
bank_health_service = BankHealthService()
