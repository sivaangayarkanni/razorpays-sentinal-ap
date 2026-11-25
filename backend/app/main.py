"""Sentinel-AP FastAPI application entrypoint."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin, agent, metrics, payments, webhooks
from app.core import database as db
from app.core.config import get_settings
from app.middleware.request_id import RequestIdMiddleware, get_request_id
from app.services.gate_pipeline import drain_due_jobs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel-ap")

APP_VERSION = "1.3.0"

# Filled during lifespan so /health can report readiness without touching the DB.
startup_state: dict[str, Any] = {
    "db": "pending",
    "queue_drainer": False,
    "error": None,
}


async def _queue_drain_loop() -> None:
    """In-process outbox pump so soft-fail jobs drain without a separate ARQ worker."""
    while True:
        try:
            async with db.AsyncSessionLocal() as session:
                results = await drain_due_jobs(session, limit=20)
                await session.commit()
                if results:
                    logger.info("in-process drain processed %s job(s)", len(results))
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("in-process drain failed")
        await asyncio.sleep(15)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (%s) v%s", settings.app_name, settings.app_env, APP_VERSION)
    drain_task: asyncio.Task | None = None
    try:
        backend = await db.startup_database()
        startup_state["db"] = backend
        startup_state["error"] = None
    except Exception as exc:  # noqa: BLE001
        # Last resort: do not crash-loop the process. /health stays up so
        # Render and the frontend can see a clear error instead of hanging.
        logger.exception("database startup failed; serving in degraded mode")
        startup_state["db"] = "unavailable"
        startup_state["error"] = f"{type(exc).__name__}: {exc}"

    if startup_state["db"] != "unavailable":
        drain_task = asyncio.create_task(_queue_drain_loop(), name="sentinel-queue-drain")
        startup_state["queue_drainer"] = True

    yield

    if drain_task is not None:
        drain_task.cancel()
        try:
            await drain_task
        except asyncio.CancelledError:
            pass
        startup_state["queue_drainer"] = False
    try:
        await db.engine.dispose()
    except Exception:  # noqa: BLE001
        logger.warning("engine dispose failed", exc_info=True)


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
    docs_url = "/docs" if settings.enable_docs else None
    redoc_url = "/redoc" if settings.enable_docs else None
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
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url="/openapi.json" if settings.enable_docs else None,
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
        db_status = startup_state.get("db") or "pending"
        # Degraded if we booted without a database; still 200 so Render/frontends
        # can distinguish "process is up" from a hung crash-loop.
        return {
            "status": "ok" if db_status != "unavailable" else "degraded",
            "service": "sentinel-ap",
            "version": APP_VERSION,
            "db": db_status,
            "queue_drainer": bool(startup_state.get("queue_drainer")),
        }

    return app


app = create_app()
