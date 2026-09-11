"""TTL cache + circuit breaker behavior for Gate 2."""
import pytest

from app.services.bank_health import (
    CIRCUIT_FAILURE_THRESHOLD,
    BankHealthService,
)


@pytest.mark.asyncio
async def test_forced_rate_bypasses_and_is_immediate():
    svc = BankHealthService()
    svc.set_mock_success_rate(0.80)
    r1 = await svc.check(threshold=0.95)
    assert r1.is_degraded
    svc.set_mock_success_rate(0.99)
    r2 = await svc.check(threshold=0.95)
    assert not r2.is_degraded


@pytest.mark.asyncio
async def test_circuit_opens_after_failures(monkeypatch):
    svc = BankHealthService()

    async def boom():
        svc._on_probe_failure()
        return 0.0, {"mode": "live", "error": "boom"}

    # Simulate consecutive failures without HTTP
    for _ in range(CIRCUIT_FAILURE_THRESHOLD):
        svc._on_probe_failure()
    status = svc.circuit_status()
    assert status["state"] == "open"
    assert status["consecutive_failures"] >= CIRCUIT_FAILURE_THRESHOLD
