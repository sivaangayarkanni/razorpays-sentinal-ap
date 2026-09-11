"""Sentinel-AP FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin, agent, metrics, payments, webhooks
from app.core.config import get_settings
from app.core.database import Base, engine
from app.middleware.request_id import RequestIdMiddleware, get_request_id
from app.seed import seed_demo_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel-ap")

APP_VERSION = "1.3.0"


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (%s) v%s", settings.app_name, settings.app_env, APP_VERSION)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_demo_data()
    yield
    await engine.dispose()


def _error_body(request: Request, *, status_code: int, detail: Any) -> dict[str, Any]:
    request_id = get_request_id(request)
    if isinstance(detail, dict):
        body = dict(detail)
    else:
        body = {"error": "http_error", "message": detail}
    body.setdefault("status_code", status_code)
    if request_id:
        body["request_id"] = request_id
    return body


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Sentinel-AP",
        description=(
            "Smart Security Guardrail middleware between Autonomous AI Agents "
            "and Razorpay Payment Gateway.\n\n"
            "**Gate 1:** Policy Hard Block (deterministic budgets / SKU lists)\n\n"
            "**Gate 2:** Bank Health Soft-Fail Queue\n\n"
            "**Payments:** Live Razorpay test-mode Orders + Checkout verify + webhooks\n\n"
            "**v1.3:** layered planes, Intent FSM, health cache/circuit breaker, "
            "durable queue drain, structured logs, public architecture diagram.\n\n"
            "Supports `Idempotency-Key` on agent intents and `X-Request-Id` on all responses."
        ),
        version=APP_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_tags=[
            {"name": "Agent", "description": "AI buyer agent payment intents (X-API-Key + Idempotency-Key)"},
            {"name": "Admin", "description": "Dashboard, policies, queue, bank health, audit"},
            {"name": "Payments", "description": "Checkout verify + Razorpay admin probe"},
            {"name": "Webhooks", "description": "Razorpay webhook receiver (payment.captured)"},
            {"name": "Public", "description": "Public config + metrics (no auth)"},
        ],
    )

    origins = list(settings.cors_origin_list)
    for extra in (
        "https://sentinel-ap.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ):
        if extra not in origins:
            origins.append(extra)

    # Middleware order: last added runs first for request
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )
    app.add_middleware(RequestIdMiddleware)

    app.include_router(agent.router, prefix=settings.api_prefix)
    app.include_router(admin.router, prefix=settings.api_prefix)
    app.include_router(payments.router, prefix=settings.api_prefix)
    app.include_router(webhooks.router, prefix=settings.api_prefix)
    app.include_router(metrics.router, prefix=settings.api_prefix)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(request, status_code=exc.status_code, detail=exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=_error_body(
                request,
                status_code=422,
                detail={
                    "error": "validation_error",
                    "message": "Request validation failed",
                    "errors": exc.errors(),
                },
            ),
        )

    @app.get("/health", tags=["Public"])
    async def health():
        return {"status": "ok", "service": "sentinel-ap", "version": APP_VERSION}

    return app


app = create_app()
