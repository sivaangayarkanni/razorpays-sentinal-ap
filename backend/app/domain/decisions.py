"""Typed gate / dispatch results — pipeline orchestrates; domain objects carry meaning."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(frozen=True)
class PolicyDecision:
    """Gate 1 outcome — deterministic authorization."""

    allowed: bool
    reason_code: str
    reason_message: str
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def outcome(self) -> str:
        return "ALLOW" if self.allowed else "HARD_BLOCK"


@dataclass(frozen=True)
class HealthDecision:
    """Gate 2 outcome — rail reliability."""

    healthy: bool
    success_rate: float
    threshold: float
    latency_ms: int
    reason_code: str
    reason_message: str
    provider: str = "razorpay"
    details: dict[str, Any] = field(default_factory=dict)
    from_cache: bool = False

    @property
    def outcome(self) -> str:
        return "ALLOW" if self.healthy else "QUEUED"

    @property
    def is_degraded(self) -> bool:
        return not self.healthy


@dataclass(frozen=True)
class PaymentDispatch:
    """Execution-plane result after Razorpay Orders API."""

    success: bool
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    mock: bool = False
    error: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def outcome(self) -> str:
        return "ALLOW" if self.success else "FAILED"

    @property
    def reason_code(self) -> str:
        if not self.success:
            return "RAZORPAY_ERROR"
        return "PAYMENT_DISPATCHED" if self.mock else "ORDER_CREATED"


@dataclass
class PipelineResult:
    """Control-plane summary after Gate 1 → Gate 2 → (optional) dispatch."""

    final_status: str
    policy: Optional[PolicyDecision] = None
    health: Optional[HealthDecision] = None
    payment: Optional[PaymentDispatch] = None
    queue_enqueued: bool = False
