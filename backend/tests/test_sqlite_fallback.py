"""Startup should fall back to SQLite when Postgres is unreachable."""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.core import database as db


def _restore(env: dict[str, str | None]) -> None:
    for key, value in env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_startup_falls_back_to_sqlite(tmp_path: Path):
    sqlite_url = f"sqlite+aiosqlite:///{tmp_path / 'sentinel.db'}"
    prev = {
        "DATABASE_URL": os.environ.get("DATABASE_URL"),
        "ALLOW_SQLITE_FALLBACK": os.environ.get("ALLOW_SQLITE_FALLBACK"),
        "SQLITE_FALLBACK_URL": os.environ.get("SQLITE_FALLBACK_URL"),
        "DEBUG": os.environ.get("DEBUG"),
    }
    os.environ["DATABASE_URL"] = "postgresql+asyncpg://sentinel:sentinel@no-such-host.invalid:5432/sentinel_ap"
    os.environ["ALLOW_SQLITE_FALLBACK"] = "true"
    os.environ["SQLITE_FALLBACK_URL"] = sqlite_url
    os.environ["DEBUG"] = "false"
    get_settings.cache_clear()
    db.configure_engine(get_settings().database_url)
    try:
        backend = await db.startup_database()
        assert backend == "sqlite"
        assert db.db_backend == "sqlite"
        async with db.AsyncSessionLocal() as session:
            orgs = (await session.execute(text("select count(*) from organizations"))).scalar_one()
        assert int(orgs) >= 1
    finally:
        try:
            await db.engine.dispose()
        except Exception:
            pass
        _restore(prev)
        # Rebind the module engine to whatever the restored settings say,
        # so later tests are not stuck on the tmp sqlite file.
        db.configure_engine(get_settings().database_url)
