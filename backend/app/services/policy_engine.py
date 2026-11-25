"""Gate 1 — Deterministic AI Logic & Policy Guardrail (Hard Block)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from app.models.entities import Policy

# Amounts above this are treated as unsound, even if a policy cap is higher.
ABSURD_AMOUNT_PAISE = 1_00_00_000_00  # ₹1,00,00,000


@dataclass
class PolicyVerdict:
    allowed: bool
    reason_code: Optional[str] = None
    reason_message: Optional[str] = None
    details: dict[str, Any] = field(default_factory=dict)


def _hour_in_timezone(now: datetime, tz_name: str) -> int:
    tz_name = (tz_name or "Asia/Kolkata").strip() or "Asia/Kolkata"
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    try:
        return now.astimezone(ZoneInfo(tz_name)).hour
    except Exception:
        return now.astimezone(timezone.utc).hour


def _outside_window(policy: Policy, now: datetime) -> bool:
    start = getattr(policy, "window_start_hour", None)
    end = getattr(policy, "window_end_hour", None)
    if start is None or end is None:
        return False
    start = int(start)
    end = int(end)
    if start == end:
        return False
    hour = _hour_in_timezone(now, getattr(policy, "window_timezone", None) or "Asia/Kolkata")
    if start < end:
        return not (start <= hour < end)
    return not (hour >= start or hour < end)


class PolicyEngine:
    """Pure deterministic policy checks — no I/O, easy to unit test."""

    def evaluate(
        self,
        *,
        amount_paise: int,
        currency: str,
        sku: str,
        policy: Policy,
        spent_today_paise: int = 0,
        recent_intent_count: int = 0,
        now: datetime | None = None,
    ) -> PolicyVerdict:
        if not policy.is_active:
            return PolicyVerdict(
                allowed=False,
                reason_code="POLICY_INACTIVE",
                reason_message="Active policy not found for organization",
            )

        if amount_paise <= 0:
            return PolicyVerdict(
                allowed=False,
                reason_code="AMOUNT_INVALID",
                reason_message="Amount must be a positive integer in paise",
                details={"amount_paise": amount_paise},
            )

        if amount_paise > ABSURD_AMOUNT_PAISE:
            return PolicyVerdict(
                allowed=False,
                reason_code="AMOUNT_ABSURD",
                reason_message=(
                    f"Amount ₹{amount_paise / 100:.2f} exceeds the sanity limit "
                    f"of ₹{ABSURD_AMOUNT_PAISE / 100:.2f}"
                ),
                details={"amount_paise": amount_paise, "max_sane_paise": ABSURD_AMOUNT_PAISE},
            )

        currency = (currency or "").upper()
        allowed_currencies = [c.upper() for c in (policy.allowed_currencies or ["INR"])]
        if currency not in allowed_currencies:
            return PolicyVerdict(
                allowed=False,
                reason_code="CURRENCY_DENIED",
                reason_message=f"Currency {currency or '(empty)'} not in allowed list {allowed_currencies}",
                details={"currency": currency, "allowed": allowed_currencies},
            )

        blacklist = [s.upper() for s in (policy.sku_blacklist or [])]
        if sku.upper() in blacklist:
            return PolicyVerdict(
                allowed=False,
                reason_code="SKU_BLACKLISTED",
                reason_message=f"SKU '{sku}' is blacklisted",
                details={"sku": sku, "blacklist": policy.sku_blacklist},
            )

        whitelist = [s.upper() for s in (policy.sku_whitelist or [])]
        if whitelist and sku.upper() not in whitelist:
            return PolicyVerdict(
                allowed=False,
                reason_code="SKU_NOT_WHITELISTED",
                reason_message=f"SKU '{sku}' is not in the whitelist",
                details={"sku": sku, "whitelist": policy.sku_whitelist},
            )

        if amount_paise > policy.max_amount_paise:
            return PolicyVerdict(
                allowed=False,
                reason_code="AMOUNT_CAP_EXCEEDED",
                reason_message=(
                    f"Amount ₹{amount_paise / 100:.2f} exceeds per-txn cap "
                    f"₹{policy.max_amount_paise / 100:.2f}"
                ),
                details={
                    "amount_paise": amount_paise,
                    "max_amount_paise": policy.max_amount_paise,
                },
            )

        projected = spent_today_paise + amount_paise
        if projected > policy.daily_budget_paise:
            return PolicyVerdict(
                allowed=False,
                reason_code="DAILY_BUDGET_EXCEEDED",
                reason_message=(
                    f"Daily budget for this agent key would be exceeded "
                    f"(spent ₹{spent_today_paise / 100:.2f} + ₹{amount_paise / 100:.2f} "
                    f"> ₹{policy.daily_budget_paise / 100:.2f})"
                ),
                details={
                    "spent_today_paise": spent_today_paise,
                    "amount_paise": amount_paise,
                    "daily_budget_paise": policy.daily_budget_paise,
                },
            )

        max_per_min = int(getattr(policy, "max_intents_per_minute", 0) or 0)
        if max_per_min > 0 and recent_intent_count >= max_per_min:
            return PolicyVerdict(
                allowed=False,
                reason_code="VELOCITY_EXCEEDED",
                reason_message=(
                    f"Too many intents from this agent key in the last minute "
                    f"({recent_intent_count} ≥ {max_per_min})"
                ),
                details={
                    "recent_intent_count": recent_intent_count,
                    "max_intents_per_minute": max_per_min,
                },
            )

        when = now or datetime.now(timezone.utc)
        if _outside_window(policy, when):
            tz_name = getattr(policy, "window_timezone", None) or "Asia/Kolkata"
            return PolicyVerdict(
                allowed=False,
                reason_code="OUTSIDE_PAYMENT_WINDOW",
                reason_message=(
                    f"Payments are only allowed between {policy.window_start_hour:02d}:00 "
                    f"and {policy.window_end_hour:02d}:00 ({tz_name})"
                ),
                details={
                    "window_start_hour": policy.window_start_hour,
                    "window_end_hour": policy.window_end_hour,
                    "window_timezone": tz_name,
                    "hour": _hour_in_timezone(when, tz_name),
                },
            )

        return PolicyVerdict(
            allowed=True,
            reason_code="POLICY_PASS",
            reason_message="Passed Gate 1 policy checks",
            details={
                "amount_paise": amount_paise,
                "sku": sku,
                "spent_today_paise": spent_today_paise,
            },
        )
