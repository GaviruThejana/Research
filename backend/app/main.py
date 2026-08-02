"""
FastAPI application entrypoint.

Run locally with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
"""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import get_settings
from app.logging_config import configure_logging, get_logger
from app.schemas import ErrorResponse
from app.services.inference import get_inference_manager

settings = get_settings()
configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s (env=%s)", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)
    manager = get_inference_manager(settings)
    try:
        manager.load()
        logger.info("Model warm-loaded successfully on device=%s", manager.device)
    except Exception as exc:  # noqa: BLE001
        # Do not crash the app on startup if weights are missing/corrupt;
        # the health endpoint will surface `model_loaded=False` and
        # /predict will attempt a lazy reload on first request.
        logger.error("Model warm-load failed at startup: %s", exc)

    yield

    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Production-grade multi-modal (image + metadata) skin disease "
        "classification API with Grad-CAM explainability."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    """Attaches a request ID and logs basic request/response telemetry."""
    request_id = str(uuid.uuid4())
    start_time = time.perf_counter()

    response = await call_next(request)

    duration_ms = (time.perf_counter() - start_time) * 1000.0
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "HTTP request handled",
        extra={
            "extra_fields": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
        },
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Request validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ErrorResponse(
            detail="Request validation failed.",
            error_code="VALIDATION_ERROR",
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            detail="An unexpected internal error occurred.",
            error_code="INTERNAL_ERROR",
        ).model_dump(),
    )


app.include_router(router)


@app.get("/", tags=["System"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": "/health",
    }
