"""Production mode: no demo key, hidden docs, gated demo endpoints, admin password flow."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.core.config import get_settings
from app.core import database as db
from app.models.entities import AdminAccount, Agent
from app.seed import DEMO_API_KEY, is_weak_admin_password, validate_new_admin_password


def _restore(env: dict[str, str | None]) -> None:
    for key, value in env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


def test_weak_password_detection():
    assert is_weak_admin_password("admin123") is True
    assert is_weak_admin_password("short") is True
    assert is_weak_admin_password("a-reasonably-long-pass") is False
    assert validate_new_admin_password("admin123") is not None
    assert validate_new_admin_password("a-reasonably-long-pass") is None


def test_docs_hidden_by_default():
    prev = {k: os.environ.get(k) for k in ("ENABLE_DOCS", "ENABLE_DEMO")}
    os.environ["ENABLE_DOCS"] = "false"
    os.environ["ENABLE_DEMO"] = "false"
    get_settings.cache_clear()
    from app.main import create_app

    app = create_app()
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/docs" not in paths
    assert "/redoc" not in paths
    _restore(prev)


def test_docs_available_when_enabled():
    prev = {k: os.environ.get(k) for k in ("ENABLE_DOCS",)}
    os.environ["ENABLE_DOCS"] = "true"
    get_settings.cache_clear()
    from app.main import create_app

    app = create_app()
    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/docs" in paths
    _restore(prev)


@pytest.mark.asyncio
async def test_bootstrap_and_admin_flow(tmp_path: Path):
    sqlite_url = f"sqlite+aiosqlite:///{tmp_path / 'prod.db'}"
    keys = [
        "DATABASE_URL",
        "ALLOW_SQLITE_FALLBACK",
        "SQLITE_FALLBACK_URL",
        "DEBUG",
        "ENABLE_DEMO",
        "ENABLE_DOCS",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "JWT_SECRET",
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_MOCK",
    ]
    prev = {k: os.environ.get(k) for k in keys}
    os.environ.update(
        {
            "DATABASE_URL": sqlite_url,
            "ALLOW_SQLITE_FALLBACK": "true",
            "SQLITE_FALLBACK_URL": sqlite_url,
            "DEBUG": "false",
            "ENABLE_DEMO": "false",
            "ENABLE_DOCS": "false",
            "ADMIN_EMAIL": "admin@sentinel-ap.local",
            "ADMIN_PASSWORD": "admin123",
            "JWT_SECRET": "unit-test-jwt-secret-not-for-prod",
            "RAZORPAY_KEY_ID": "",
            "RAZORPAY_KEY_SECRET": "",
            "RAZORPAY_MOCK": "false",
        }
    )
    get_settings.cache_clear()
    db.configure_engine(get_settings().database_url)
    try:
        await db.startup_database()
        async with db.AsyncSessionLocal() as session:
            live_demo = (
                await session.execute(
                    select(Agent).where(Agent.api_key_prefix == DEMO_API_KEY[:12], Agent.is_active.is_(True))
                )
            ).scalars().all()
            assert live_demo == []
            admins = (await session.execute(select(AdminAccount))).scalars().all()
            assert len(admins) == 1
            assert admins[0].must_change_password is True

        from app.main import create_app

        app = create_app()
        with TestClient(app) as client:
            assert client.get("/docs").status_code in (404, 405)
            login = client.post(
                "/api/v1/admin/login",
                json={"email": "admin@sentinel-ap.local", "password": "admin123"},
            )
            assert login.status_code == 200, login.text
            body = login.json()
            assert body["must_change_password"] is True
            token = body["access_token"]

            blocked = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
            assert blocked.status_code == 403

            changed = client.post(
                "/api/v1/admin/change-password",
                headers={"Authorization": f"Bearer {token}"},
                json={"current_password": "admin123", "new_password": "unit-test-admin-pass"},
            )
            assert changed.status_code == 200, changed.text
            new_token = changed.json()["access_token"]
            assert changed.json()["must_change_password"] is False

            # old token must no longer work
            stale = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {token}"})
            assert stale.status_code == 401

            stats = client.get("/api/v1/admin/stats", headers={"Authorization": f"Bearer {new_token}"})
            assert stats.status_code == 200

            override = client.post(
                "/api/v1/admin/bank-health/config",
                headers={"Authorization": f"Bearer {new_token}"},
                json={"mock_success_rate": 0.5, "threshold": 0.9},
            )
            assert override.status_code == 403

            created = client.post(
                "/api/v1/admin/agents",
                headers={"Authorization": f"Bearer {new_token}"},
                json={"name": "unit-bot"},
            )
            assert created.status_code == 200, created.text
            assert created.json()["api_key"]
            assert created.json()["api_key"].startswith("sap_")
            agent_id = created.json()["id"]

            revoked = client.post(
                f"/api/v1/admin/agents/{agent_id}/revoke",
                headers={"Authorization": f"Bearer {new_token}"},
            )
            assert revoked.status_code == 200
            assert revoked.json()["is_active"] is False
    finally:
        try:
            await db.engine.dispose()
        except Exception:
            pass
        _restore(prev)
        db.configure_engine(get_settings().database_url)
