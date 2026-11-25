"""HTTP-level HARD_BLOCK reason codes, idempotency conflict, and health payload."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core import database as db
from app.core.config import get_settings


def _restore(env: dict[str, str | None]) -> None:
    for key, value in env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


@pytest.fixture
def client(tmp_path: Path):
    sqlite_url = f"sqlite+aiosqlite:///{tmp_path / 'edges.db'}"
    keys = [
        "DATABASE_URL",
        "ALLOW_SQLITE_FALLBACK",
        "SQLITE_FALLBACK_URL",
        "DEBUG",
        "ENABLE_DEMO",
        "ENABLE_DOCS",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "ADMIN_PASSWORD_HASH",
        "JWT_SECRET",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_MOCK",
        "REDIS_URL",
    ]
    prev = {k: os.environ.get(k) for k in keys}
    os.environ.pop("ADMIN_PASSWORD_HASH", None)
    os.environ.update(
        {
            "DATABASE_URL": sqlite_url,
            "ALLOW_SQLITE_FALLBACK": "true",
            "SQLITE_FALLBACK_URL": sqlite_url,
            "DEBUG": "false",
            "ENABLE_DEMO": "false",
            "ENABLE_DOCS": "false",
            "ADMIN_EMAIL": "admin@sentinel-ap.local",
            "ADMIN_PASSWORD": "unit-test-admin-pass",
            "JWT_SECRET": "unit-test-jwt-secret-not-for-prod",
            "RAZORPAY_KEY_ID": "",
            "RAZORPAY_KEY_SECRET": "",
            "RAZORPAY_MOCK": "true",
            "REDIS_URL": "",
        }
    )
    get_settings.cache_clear()
    db.configure_engine(get_settings().database_url)
    try:
        # startup happens in TestClient lifespan
        from app.main import create_app

        app = create_app()
        with TestClient(app) as c:
            yield c
    finally:
        _restore(prev)


def _login(client: TestClient) -> str:
    res = client.post(
        "/api/v1/admin/login",
        json={"email": "admin@sentinel-ap.local", "password": "unit-test-admin-pass"},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _agent_key(client: TestClient, token: str, name: str = "edge-key") -> str:
    res = client.post(
        "/api/v1/admin/agents",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": name},
    )
    assert res.status_code in (200, 201), res.text
    key = res.json().get("api_key")
    assert key and key.startswith("sap_")
    return key


def _intent(client: TestClient, api_key: str, body: dict, idem: str | None = None, expected=200):
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    if idem:
        headers["Idempotency-Key"] = idem
    res = client.post("/api/v1/agent/intents", headers=headers, json=body)
    assert res.status_code == expected, res.text
    return res


def test_health_includes_redis_and_is_not_mock(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] in ("ok", "degraded")
    assert "db" in body
    assert body.get("redis") in ("ok", "unavailable", "not_configured")
    assert body.get("razorpay_keys") is False
    cfg = client.get("/api/v1/public/config")
    assert cfg.status_code == 200
    assert cfg.json()["mock"] is False


def test_hard_block_reason_codes(client: TestClient):
    token = _login(client)
    key = _agent_key(client, token)
    cases = [
        ({"amount_paise": 0, "currency": "INR", "sku": "LAPTOP-PRO"}, "AMOUNT_INVALID"),
        ({"amount_paise": -50, "currency": "INR", "sku": "LAPTOP-PRO"}, "AMOUNT_INVALID"),
        ({"amount_paise": 1_00_00_000_00 + 1, "currency": "INR", "sku": "LAPTOP-PRO"}, "AMOUNT_ABSURD"),
        ({"amount_paise": 100_00, "currency": "USD", "sku": "LAPTOP-PRO"}, "CURRENCY_DENIED"),
        ({"amount_paise": 100_00, "currency": "INR", "sku": "WEAPON"}, "SKU_BLACKLISTED"),
        ({"amount_paise": 100_00, "currency": "INR", "sku": "UNKNOWN-SKU"}, "SKU_NOT_WHITELISTED"),
        ({"amount_paise": 50_001_00, "currency": "INR", "sku": "LAPTOP-PRO"}, "AMOUNT_CAP_EXCEEDED"),
    ]
    for body, code in cases:
        res = _intent(client, key, body)
        data = res.json()
        assert data["status"] == "HARD_BLOCK", data
        reasons = [d.get("reason_code") for d in data.get("decisions") or []]
        assert code in reasons, (code, data)


def test_velocity_hard_block(client: TestClient):
    token = _login(client)
    key = _agent_key(client, token, name="velocity-key")
    body = {"amount_paise": 100_00, "currency": "INR", "sku": "MOUSE-MX", "description": "velocity"}
    # Default max is 8/min. 8 successful policy passes (then fail at Razorpay or queue)
    # still increment intent count. 9th should HARD_BLOCK.
    outcomes = []
    for i in range(9):
        res = _intent(client, key, {**body, "external_ref": f"v-{i}"})
        outcomes.append(res.json()["status"])
    assert "VELOCITY_EXCEEDED" in [
        d.get("reason_code") for d in _intent(client, key, {**body, "external_ref": "v-last"}).json().get("decisions") or []
    ] or outcomes.count("HARD_BLOCK") >= 1
    # The 9th of the loop should already be the first velocity block; assert explicitly.
    # After 8 intents, 9th is VELOCITY. outcomes[8] is the 9th.
    last = outcomes[8]
    # Re-fetch isn't needed; if first 8 passed Gate 1 they may be FAILED (no keys) or QUEUED.
    # FAILED still counts in recent_intent_count.
    res = client.post(
        "/api/v1/agent/intents",
        headers={"X-API-Key": key, "Content-Type": "application/json"},
        json={**body, "external_ref": "v-confirm"},
    )
    data = res.json()
    reasons = [d.get("reason_code") for d in data.get("decisions") or []]
    assert data["status"] == "HARD_BLOCK"
    assert "VELOCITY_EXCEEDED" in reasons


def test_idempotency_conflict(client: TestClient):
    token = _login(client)
    key = _agent_key(client, token, name="idem-key")
    idem = str(uuid.uuid4())
    first = _intent(
        client,
        key,
        {"amount_paise": 100_00, "currency": "INR", "sku": "MOUSE-MX", "description": "one"},
        idem=idem,
    )
    replay = _intent(
        client,
        key,
        {"amount_paise": 100_00, "currency": "INR", "sku": "MOUSE-MX", "description": "one"},
        idem=idem,
    )
    assert replay.json()["id"] == first.json()["id"]
    conflict = client.post(
        "/api/v1/agent/intents",
        headers={"X-API-Key": key, "Content-Type": "application/json", "Idempotency-Key": idem},
        json={"amount_paise": 200_00, "currency": "INR", "sku": "MOUSE-MX", "description": "two"},
    )
    assert conflict.status_code == 409
    body = conflict.json()
    detail = body.get("detail") if isinstance(body.get("detail"), dict) else body
    assert detail["reason_code"] == "IDEMPOTENCY_KEY_CONFLICT"


def test_revoked_key_is_unauthorized(client: TestClient):
    token = _login(client)
    created = client.post(
        "/api/v1/admin/agents",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "revoke-me"},
    )
    assert created.status_code in (200, 201)
    body = created.json()
    api_key = body["api_key"]
    agent_id = body["id"]
    revoked = client.post(
        f"/api/v1/admin/agents/{agent_id}/revoke",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert revoked.status_code == 200
    res = client.post(
        "/api/v1/agent/intents",
        headers={"X-API-Key": api_key, "Content-Type": "application/json"},
        json={"amount_paise": 100_00, "currency": "INR", "sku": "MOUSE-MX"},
    )
    assert res.status_code == 401
