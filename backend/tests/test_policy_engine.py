"""Unit tests for Gate 1 policy engine."""
from datetime import datetime
from zoneinfo import ZoneInfo

from app.models.entities import Policy
from app.services.policy_engine import ABSURD_AMOUNT_PAISE, PolicyEngine


def _policy(**kwargs) -> Policy:
    defaults = dict(
        name="test",
        is_active=True,
        max_amount_paise=10_000_00,
        daily_budget_paise=50_000_00,
        sku_whitelist=["LAPTOP-PRO", "MOUSE-MX"],
        sku_blacklist=["WEAPON", "GAMBLING"],
        allowed_currencies=["INR"],
        max_intents_per_minute=8,
        window_start_hour=None,
        window_end_hour=None,
        window_timezone="Asia/Kolkata",
    )
    defaults.update(kwargs)
    return Policy(**defaults)


engine = PolicyEngine()


def test_allow_whitelisted_sku():
    v = engine.evaluate(amount_paise=5_000_00, currency="INR", sku="LAPTOP-PRO", policy=_policy())
    assert v.allowed
    assert v.reason_code == "POLICY_PASS"


def test_hard_block_blacklisted_sku():
    v = engine.evaluate(amount_paise=100_00, currency="INR", sku="WEAPON", policy=_policy())
    assert not v.allowed
    assert v.reason_code == "SKU_BLACKLISTED"


def test_hard_block_not_whitelisted():
    v = engine.evaluate(amount_paise=100_00, currency="INR", sku="UNKNOWN-SKU", policy=_policy())
    assert not v.allowed
    assert v.reason_code == "SKU_NOT_WHITELISTED"


def test_hard_block_amount_cap():
    v = engine.evaluate(amount_paise=15_000_00, currency="INR", sku="LAPTOP-PRO", policy=_policy())
    assert not v.allowed
    assert v.reason_code == "AMOUNT_CAP_EXCEEDED"


def test_hard_block_daily_budget():
    v = engine.evaluate(
        amount_paise=5_000_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(),
        spent_today_paise=48_000_00,
    )
    assert not v.allowed
    assert v.reason_code == "DAILY_BUDGET_EXCEEDED"


def test_currency_denied():
    v = engine.evaluate(amount_paise=100_00, currency="USD", sku="LAPTOP-PRO", policy=_policy())
    assert not v.allowed
    assert v.reason_code == "CURRENCY_DENIED"


def test_empty_whitelist_allows_any_non_blacklisted():
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="ANYTHING",
        policy=_policy(sku_whitelist=[]),
    )
    assert v.allowed


def test_inactive_policy():
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(is_active=False),
    )
    assert not v.allowed
    assert v.reason_code == "POLICY_INACTIVE"


def test_amount_invalid_zero_and_negative():
    for amount in (0, -1, -500):
        v = engine.evaluate(amount_paise=amount, currency="INR", sku="LAPTOP-PRO", policy=_policy())
        assert not v.allowed
        assert v.reason_code == "AMOUNT_INVALID"


def test_amount_absurd():
    v = engine.evaluate(
        amount_paise=ABSURD_AMOUNT_PAISE + 1,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(max_amount_paise=ABSURD_AMOUNT_PAISE + 100, sku_whitelist=[]),
    )
    assert not v.allowed
    assert v.reason_code == "AMOUNT_ABSURD"


def test_velocity_exceeded():
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(max_intents_per_minute=3),
        recent_intent_count=3,
    )
    assert not v.allowed
    assert v.reason_code == "VELOCITY_EXCEEDED"


def test_velocity_under_limit_passes():
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(max_intents_per_minute=3),
        recent_intent_count=2,
    )
    assert v.allowed


def test_outside_payment_window():
    # 20:00 IST is outside 09:00–18:00 IST.
    now = datetime(2026, 11, 25, 20, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(window_start_hour=9, window_end_hour=18, window_timezone="Asia/Kolkata"),
        now=now,
    )
    assert not v.allowed
    assert v.reason_code == "OUTSIDE_PAYMENT_WINDOW"


def test_inside_payment_window():
    now = datetime(2026, 11, 25, 10, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    v = engine.evaluate(
        amount_paise=100_00,
        currency="INR",
        sku="LAPTOP-PRO",
        policy=_policy(window_start_hour=9, window_end_hour=18, window_timezone="Asia/Kolkata"),
        now=now,
    )
    assert v.allowed


def test_overnight_payment_window():
    policy = _policy(window_start_hour=22, window_end_hour=6, window_timezone="Asia/Kolkata")
    late = datetime(2026, 11, 25, 23, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    early = datetime(2026, 11, 26, 5, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    midday = datetime(2026, 11, 26, 12, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    assert engine.evaluate(amount_paise=100_00, currency="INR", sku="LAPTOP-PRO", policy=policy, now=late).allowed
    assert engine.evaluate(amount_paise=100_00, currency="INR", sku="LAPTOP-PRO", policy=policy, now=early).allowed
    blocked = engine.evaluate(amount_paise=100_00, currency="INR", sku="LAPTOP-PRO", policy=policy, now=midday)
    assert not blocked.allowed
    assert blocked.reason_code == "OUTSIDE_PAYMENT_WINDOW"
