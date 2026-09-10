"""Sentinel-AP FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, agent
from app.core.config import get_settings
from app.core.database import Base, engine
from app.seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel-ap")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)
    # Auto-create tables for demo/docker; Alembic used for production migrations
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_demo_data()
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Sentinel-AP",
        description=(
            "Smart Security Guardrail middleware between Autonomous AI Agents "
            "and Razorpay Payment Gateway. Gate 1: Policy Hard Block. "
            "Gate 2: Bank Health Soft-Fail Queue."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(agent.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "sentinel-ap"}

    return app


app = create_app()
