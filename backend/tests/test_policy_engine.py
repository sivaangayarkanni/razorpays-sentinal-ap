"""Unit tests for Gate 1 policy engine."""
from app.models.entities import Policy
from app.services.policy_engine import PolicyEngine


def _policy(**kwargs) -> Policy:
    defaults = dict(
        name="test",
        is_active=True,
        max_amount_paise=10_000_00,
        daily_budget_paise=50_000_00,
        sku_whitelist=["LAPTOP-PRO", "MOUSE-MX"],
        sku_blacklist=["WEAPON", "GAMBLING"],
        allowed_currencies=["INR"],
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
