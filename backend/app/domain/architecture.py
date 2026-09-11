"""Public architecture diagram (no secrets) for docs / frontend."""
from __future__ import annotations

from typing import Any


def architecture_diagram(*, version: str = "1.3.0") -> dict[str, Any]:
    """JSON diagram of planes, gates, and intent FSM — safe for public GET."""
    return {
        "service": "sentinel-ap",
        "version": version,
        "description": (
            "Payment control plane between autonomous AI buyer agents and Razorpay. "
            "Agents never call Razorpay directly."
        ),
        "planes": [
            {
                "id": "ingress",
                "name": "Ingress",
                "responsibilities": [
                    "X-API-Key auth",
                    "rate limit",
                    "Idempotency-Key",
                    "X-Request-Id",
                ],
            },
            {
                "id": "control",
                "name": "Control plane",
                "responsibilities": [
                    "Gate 1 Policy (HARD_BLOCK | PASS)",
                    "Gate 2 Bank Health (QUEUED | PASS)",
                    "Intent FSM transitions",
                ],
            },
            {
                "id": "execution",
                "name": "Execution plane",
                "responsibilities": [
                    "Razorpay Orders create",
                    "Checkout signature verify",
                    "payment.captured webhooks",
                ],
            },
            {
                "id": "reliability",
                "name": "Reliability plane",
                "responsibilities": [
                    "Soft-fail QueueJob outbox",
                    "next_retry_at + attempts FSM",
                    "ARQ worker / admin drain",
                ],
            },
            {
                "id": "observability",
                "name": "Observability",
                "responsibilities": [
                    "audit_events",
                    "decisions trail",
                    "public metrics",
                    "structured logs (request_id, intent_id, gate, outcome)",
                ],
            },
        ],
        "gates": [
            {
                "id": "gate1",
                "name": "Policy Engine",
                "pass": "ALLOW (continue)",
                "fail": "HARD_BLOCK",
                "reason_codes": [
                    "POLICY_PASS",
                    "AMOUNT_CAP_EXCEEDED",
                    "DAILY_BUDGET_EXCEEDED",
                    "SKU_BLACKLISTED",
                    "SKU_NOT_WHITELISTED",
                    "CURRENCY_DENIED",
                    "POLICY_INACTIVE",
                ],
            },
            {
                "id": "gate2",
                "name": "Bank Health",
                "pass": "ALLOW (dispatch)",
                "fail": "QUEUED",
                "reason_codes": ["BANK_HEALTHY", "BANK_DEGRADED", "QUEUE_EXHAUSTED"],
                "notes": "Short TTL cache + circuit breaker on live probe failures",
            },
            {
                "id": "razorpay",
                "name": "Payment dispatch / verify",
                "pass": "ALLOW → VERIFIED (logical) / CLEARED",
                "fail": "FAILED",
                "reason_codes": [
                    "ORDER_CREATED",
                    "PAYMENT_DISPATCHED",
                    "PAYMENT_VERIFIED",
                    "QUEUE_CLEARED",
                    "RAZORPAY_ERROR",
                ],
            },
        ],
        "intent_fsm": {
            "states": [
                "PENDING",
                "HARD_BLOCK",
                "QUEUED",
                "ALLOW",
                "CLEARED",
                "FAILED",
                "VERIFIED",
            ],
            "note": (
                "PENDING is transient before gates finish. VERIFIED is the post-Checkout "
                "logical state; persisted status remains ALLOW for API compatibility "
                "(reason_code=PAYMENT_VERIFIED). CLEARED is used when a soft-fail job recovers."
            ),
            "transitions": [
                {"from": "PENDING", "to": "HARD_BLOCK", "via": "gate1_fail"},
                {"from": "PENDING", "to": "QUEUED", "via": "gate1_pass + gate2_degraded"},
                {"from": "PENDING", "to": "ALLOW", "via": "gate1_pass + gate2_healthy + order_ok"},
                {"from": "PENDING", "to": "FAILED", "via": "order_error"},
                {"from": "QUEUED", "to": "CLEARED", "via": "queue_retry_success"},
                {"from": "QUEUED", "to": "FAILED", "via": "queue_exhausted"},
                {"from": "QUEUED", "to": "QUEUED", "via": "queue_retry_still_degraded"},
                {"from": "ALLOW", "to": "VERIFIED", "via": "checkout_verify_or_webhook"},
                {"from": "CLEARED", "to": "VERIFIED", "via": "checkout_verify_or_webhook"},
            ],
        },
        "queue_job_fsm": {
            "states": [
                "PENDING",
                "PROCESSING",
                "RETRYING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
            ],
            "transitions": [
                {"from": "PENDING", "to": "PROCESSING", "via": "worker_or_admin_drain"},
                {"from": "PROCESSING", "to": "COMPLETED", "via": "dispatch_ok"},
                {"from": "PROCESSING", "to": "RETRYING", "via": "still_degraded_or_transient"},
                {"from": "RETRYING", "to": "PROCESSING", "via": "next_attempt_at"},
                {"from": "PROCESSING", "to": "FAILED", "via": "max_attempts"},
                {"from": "*", "to": "CANCELLED", "via": "admin_cancel"},
            ],
        },
        "endpoints": {
            "agent_intents": "POST /api/v1/agent/intents",
            "verify": "POST /api/v1/payments/verify",
            "webhook": "POST /api/v1/webhooks/razorpay",
            "public_config": "GET /api/v1/public/config",
            "public_metrics": "GET /api/v1/public/metrics",
            "public_architecture": "GET /api/v1/public/architecture",
            "admin_system": "GET /api/v1/admin/system",
            "admin_queue_drain": "POST /api/v1/admin/queue/drain",
        },
    }
