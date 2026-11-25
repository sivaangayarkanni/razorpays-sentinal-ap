"""Async SQLAlchemy engine and session factory."""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

logger = logging.getLogger("sentinel-ap.db")


class Base(DeclarativeBase):
    pass


class _SessionMakerProxy:
    """Indirection so callers can keep `from app.core.database import AsyncSessionLocal`
    even after we rebind the engine (SQLite fallback)."""

    def __init__(self) -> None:
        self._impl: async_sessionmaker[AsyncSession] | None = None

    def bind(self, impl: async_sessionmaker[AsyncSession]) -> None:
        self._impl = impl

    def __call__(self, *args, **kwargs):
        if self._impl is None:
            raise RuntimeError("database session factory is not configured")
        return self._impl(*args, **kwargs)

    def __getattr__(self, name: str):
        if self._impl is None:
            raise RuntimeError("database session factory is not configured")
        return getattr(self._impl, name)


engine: AsyncEngine
AsyncSessionLocal = _SessionMakerProxy()
db_backend: str = "postgres"
runtime_url: str = ""


def is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite")


def make_engine(url: str) -> AsyncEngine:
    settings = get_settings()
    if is_sqlite_url(url):
        return create_async_engine(
            url,
            echo=settings.debug,
            connect_args={"check_same_thread": False},
        )
    return create_async_engine(
        url,
        echo=settings.debug,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        connect_args={"timeout": 10},
    )


def configure_engine(url: str) -> None:
    """Synchronously (re)bind the module-level engine and session factory."""
    global engine, db_backend, runtime_url
    engine = make_engine(url)
    AsyncSessionLocal.bind(async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False))
    runtime_url = url
    db_backend = "sqlite" if is_sqlite_url(url) else "postgres"


async def rebind_engine(url: str) -> None:
    global engine
    old = engine
    configure_engine(url)
    try:
        await old.dispose()
    except Exception:  # noqa: BLE001
        logger.warning("failed to dispose previous engine", exc_info=True)


# Bind to settings at import time (tests / local dev). Lifespan may rebind later.
configure_engine(get_settings().database_url)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_schema_and_seed() -> None:
    """Create tables (idempotent) and seed demo rows if missing."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Imported lazily to avoid circular imports at module load.
    from app.seed import seed_demo_data

    await seed_demo_data()


async def startup_database() -> str:
    """Connect to the configured database with retries.

    If Postgres is unreachable and ALLOW_SQLITE_FALLBACK is true, switch to
    SQLite so the process can serve traffic instead of crash-looping.
    Returns the backend name ('postgres' or 'sqlite').
    """
    import asyncio

    settings = get_settings()
    last_error: Exception | None = None
    attempts = 3
    for attempt in range(1, attempts + 1):
        try:
            await asyncio.wait_for(init_schema_and_seed(), timeout=15)
            logger.info("database ready (%s)", db_backend)
            return db_backend
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("database init attempt %s/%s failed: %s", attempt, attempts, exc)
            if attempt < attempts:
                await asyncio.sleep(min(2 * attempt, 5))

    if settings.allow_sqlite_fallback and not is_sqlite_url(runtime_url):
        logger.warning(
            "Postgres unreachable (%s); falling back to SQLite at %s",
            last_error,
            settings.sqlite_fallback_url,
        )
        await rebind_engine(settings.sqlite_fallback_url)
        await init_schema_and_seed()
        return db_backend

    assert last_error is not None
    raise last_error
