"""Tests for Gate 2 bank health gating."""
import pytest

from app.services.bank_health import BankHealthService


@pytest.mark.asyncio
async def test_healthy_above_threshold():
    svc = BankHealthService()
    svc.set_mock_success_rate(0.99)
    result = await svc.check(threshold=0.95)
    assert not result.is_degraded
    assert result.success_rate == 0.99


@pytest.mark.asyncio
async def test_degraded_below_threshold():
    svc = BankHealthService()
    svc.set_mock_success_rate(0.80)
    result = await svc.check(threshold=0.95)
    assert result.is_degraded
    assert result.success_rate == 0.80


@pytest.mark.asyncio
async def test_exact_threshold_not_degraded():
    svc = BankHealthService()
    svc.set_mock_success_rate(0.95)
    result = await svc.check(threshold=0.95)
    assert not result.is_degraded
