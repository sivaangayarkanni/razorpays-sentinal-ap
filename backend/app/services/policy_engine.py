"""Gate 1 — Deterministic AI Logic & Policy Guardrail (Hard Block)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.models.entities import Policy


@dataclass
class PolicyVerdict:
    allowed: bool
    reason_code: Optional[str] = None
    reason_message: Optional[str] = None
    details: dict[str, Any] = field(default_factory=dict)


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
    ) -> PolicyVerdict:
        if not policy.is_active:
            return PolicyVerdict(
                allowed=False,
                reason_code="POLICY_INACTIVE",
                reason_message="Active policy not found for organization",
            )

        currency = currency.upper()
        allowed_currencies = [c.upper() for c in (policy.allowed_currencies or ["INR"])]
        if currency not in allowed_currencies:
            return PolicyVerdict(
                allowed=False,
                reason_code="CURRENCY_DENIED",
                reason_message=f"Currency {currency} not in allowed list {allowed_currencies}",
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
                    f"Daily budget would be exceeded "
                    f"(spent ₹{spent_today_paise / 100:.2f} + ₹{amount_paise / 100:.2f} "
                    f"> ₹{policy.daily_budget_paise / 100:.2f})"
                ),
                details={
                    "spent_today_paise": spent_today_paise,
                    "amount_paise": amount_paise,
                    "daily_budget_paise": policy.daily_budget_paise,
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
