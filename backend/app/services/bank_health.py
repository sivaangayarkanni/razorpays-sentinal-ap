"""Gate 2 — Payment Rail & Bank Uptime Guardrail.

Failure modes (documented for interviews):
1. Forced demo override — always used when set; bypasses cache.
2. Cache HIT — returns last probe within HEALTH_CACHE_TTL_SECONDS (default 5s).
3. Circuit OPEN — after CIRCUIT_FAILURE_THRESHOLD consecutive probe failures,
   skip live HTTP for CIRCUIT_OPEN_SECONDS and return degraded rate 0.0.
4. Live probe 5xx / network error — counts as failure toward circuit; returns low rate.
5. Live probe 2xx/4xx — treated as rail reachable; success_rate ≈ 0.99.
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import get_settings
from app.domain.decisions import HealthDecision
from app.services.razorpay_client import is_mock_mode, _record_probe

HEALTH_CACHE_TTL_SECONDS = 5.0
CIRCUIT_FAILURE_THRESHOLD = 3
CIRCUIT_OPEN_SECONDS = 30.0


@dataclass
class BankHealthResult:
    provider: str
    success_rate: float
    latency_ms: int
    is_degraded: bool
    threshold: float
    details: dict[str, Any] = field(default_factory=dict)

    def to_decision(self) -> HealthDecision:
        return HealthDecision(
            healthy=not self.is_degraded,
            success_rate=self.success_rate,
            threshold=self.threshold,
            latency_ms=self.latency_ms,
            reason_code="BANK_HEALTHY" if not self.is_degraded else "BANK_DEGRADED",
            reason_message=(
                f"Bank success rate {self.success_rate:.1%} ≥ threshold {self.threshold:.1%}"
                if not self.is_degraded
                else f"Bank success rate {self.success_rate:.1%} below threshold {self.threshold:.1%}"
            ),
            provider=self.provider,
            details=self.details,
            from_cache=bool(self.details.get("from_cache")),
        )


class BankHealthService:
    """Pre-flight bank health ping with short TTL cache + circuit breaker."""

    def __init__(self) -> None:
        self._forced_rate: float | None = None
        self._cache: tuple[float, BankHealthResult] | None = None  # (expires_at, result)
        self._consecutive_failures: int = 0
        self._circuit_open_until: float = 0.0

    def set_mock_success_rate(self, rate: float) -> None:
        """Demo control: force a success rate (0.0–1.0). Invalidates cache."""
        self._forced_rate = max(0.0, min(1.0, rate))
        self._cache = None

    def clear_forced_rate(self) -> None:
        self._forced_rate = None
        self._cache = None

    def invalidate_cache(self) -> None:
        self._cache = None

    def circuit_status(self) -> dict[str, Any]:
        now = time.monotonic()
        open_ = now < self._circuit_open_until
        return {
            "state": "open" if open_ else "closed",
            "consecutive_failures": self._consecutive_failures,
            "open_remaining_seconds": max(0.0, round(self._circuit_open_until - now, 2)),
            "failure_threshold": CIRCUIT_FAILURE_THRESHOLD,
            "cache_ttl_seconds": HEALTH_CACHE_TTL_SECONDS,
        }

    async def check(self, threshold: float | None = None) -> BankHealthResult:
        settings = get_settings()
        thr = threshold if threshold is not None else settings.bank_health_threshold
        start = time.perf_counter()

        # Forced override never uses cache (demo toggles must be immediate)
        if self._forced_rate is not None:
            success_rate = self._forced_rate
            details: dict[str, Any] = {"mode": "forced", "note": "Demo override active"}
            latency_ms = int((time.perf_counter() - start) * 1000)
            return BankHealthResult(
                provider="razorpay",
                success_rate=round(success_rate, 4),
                latency_ms=latency_ms,
                is_degraded=success_rate < thr,
                threshold=thr,
                details=details,
            )

        # TTL cache
        now = time.monotonic()
        if self._cache is not None:
            expires_at, cached = self._cache
            if now < expires_at:
                # Re-evaluate degraded against possibly new threshold
                details = {**cached.details, "from_cache": True}
                return BankHealthResult(
                    provider=cached.provider,
                    success_rate=cached.success_rate,
                    latency_ms=cached.latency_ms,
                    is_degraded=cached.success_rate < thr,
                    threshold=thr,
                    details=details,
                )

        # Circuit breaker
        if now < self._circuit_open_until:
            details = {
                "mode": "circuit_open",
                "note": "Skipping live probe; circuit open after consecutive failures",
                **self.circuit_status(),
            }
            result = BankHealthResult(
                provider="razorpay",
                success_rate=0.0,
                latency_ms=int((time.perf_counter() - start) * 1000),
                is_degraded=True,
                threshold=thr,
                details=details,
            )
            self._cache = (now + HEALTH_CACHE_TTL_SECONDS, result)
            return result

        if is_mock_mode():
            base = settings.bank_health_mock_success_rate
            jitter = random.uniform(-0.01, 0.01)
            success_rate = max(0.0, min(1.0, base + jitter))
            details = {"mode": "mock", "base_rate": base}
        else:
            success_rate, details = await self._live_probe()

        latency_ms = int((time.perf_counter() - start) * 1000)
        is_degraded = success_rate < thr
        result = BankHealthResult(
            provider="razorpay",
            success_rate=round(success_rate, 4),
            latency_ms=latency_ms,
            is_degraded=is_degraded,
            threshold=thr,
            details=details,
        )
        self._cache = (time.monotonic() + HEALTH_CACHE_TTL_SECONDS, result)
        return result

    async def check_decision(self, threshold: float | None = None) -> HealthDecision:
        return (await self.check(threshold=threshold)).to_decision()

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
                    self._on_probe_success()
                    _record_probe(True, f"bank_health probe http={resp.status_code}")
                    return 0.99, {"mode": "live", "http_status": resp.status_code}
                self._on_probe_failure()
                _record_probe(False, f"bank_health probe http={resp.status_code}")
                return 0.5, {"mode": "live", "http_status": resp.status_code, "error": "upstream_5xx"}
        except Exception as exc:  # noqa: BLE001
            self._on_probe_failure()
            _record_probe(False, f"bank_health probe error: {exc}")
            return 0.0, {"mode": "live", "error": str(exc)}

    def _on_probe_success(self) -> None:
        self._consecutive_failures = 0
        self._circuit_open_until = 0.0

    def _on_probe_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= CIRCUIT_FAILURE_THRESHOLD:
            self._circuit_open_until = time.monotonic() + CIRCUIT_OPEN_SECONDS


# Singleton for demo overrides shared across requests / worker
bank_health_service = BankHealthService()
