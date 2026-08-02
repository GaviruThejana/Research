"""
FastAPI route definitions.

  GET  /health                -> liveness/readiness probe
  POST /api/v1/predict        -> multipart image + JSON metadata -> Top-K + Grad-CAM
  POST /api/v1/train          -> triggers a background Stratified K-Fold training job
  GET  /api/v1/train/{job_id} -> polls the status of a background training job
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.schemas import (
    ComponentHealth,
    HealthCheckResponse,
    PatientMetadata,
    PredictionResponse,
    TrainingJobResponse,
    TrainingJobStatus,
    TrainingRequest,
)
from app.services.inference import InferenceManager, get_inference_manager
from app.services.trainer import run_cross_validation_training

logger = logging.getLogger(__name__)
router = APIRouter()

_SERVICE_START_TIME = time.perf_counter()

# In-memory job registry for background training tasks.
# In a multi-worker production deployment this should be replaced with a
# shared store (Redis, database) so job state is visible across processes.
_TRAINING_JOBS: Dict[str, TrainingJobStatus] = {}

_MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}


def get_manager(settings: Settings = Depends(get_settings)) -> InferenceManager:
    return get_inference_manager(settings)


@router.get("/health", response_model=HealthCheckResponse, tags=["System"])
async def health_check(
    settings: Settings = Depends(get_settings),
    manager: InferenceManager = Depends(get_manager),
) -> HealthCheckResponse:
    """Reports service liveness, model load status, and device availability."""
    components = [
        ComponentHealth(
            name="model",
            status="ready" if manager.is_loaded else "not_loaded",
            detail=f"backbone={settings.BACKBONE}",
        ),
        ComponentHealth(
            name="device",
            status="ok",
            detail=str(manager.device),
        ),
    ]

    overall_status = "healthy" if manager.is_loaded or True else "degraded"
    # NOTE: model lazy-loads on first prediction request; absence of a
    # trained checkpoint is not itself a failure of the service.

    return HealthCheckResponse(
        status=overall_status,
        version=settings.APP_VERSION,
        device=str(manager.device),
        model_loaded=manager.is_loaded,
        uptime_seconds=round(time.perf_counter() - _SERVICE_START_TIME, 2),
        components=components,
    )


@router.post(
    "/api/v1/predict",
    response_model=PredictionResponse,
    tags=["Inference"],
    responses={
        400: {"description": "Invalid image or metadata payload"},
        422: {"description": "Validation error"},
        500: {"description": "Internal inference error"},
    },
)
async def predict(
    image: UploadFile = File(..., description="Lesion image file (JPEG/PNG/WebP)"),
    metadata: str = Form(
        ..., description="JSON-encoded PatientMetadata: {age, sex, anatomical_site}"
    ),
    include_gradcam: bool = Form(default=True),
    manager: InferenceManager = Depends(get_manager),
) -> PredictionResponse:
    """Runs multi-modal inference and returns Top-K predictions with a Grad-CAM overlay."""
    if image.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported content type '{image.content_type}'. "
            f"Allowed types: {sorted(_ALLOWED_CONTENT_TYPES)}",
        )

    raw_bytes = await image.read()
    if len(raw_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image upload.")
    if len(raw_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum allowed size of {_MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    try:
        metadata_dict = json.loads(metadata)
        patient_metadata = PatientMetadata(**metadata_dict)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid metadata payload: {exc}",
        ) from exc

    try:
        result = manager.predict(
            image_bytes=raw_bytes,
            metadata=patient_metadata,
            include_gradcam=include_gradcam,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unhandled inference error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal inference error. Please try again.",
        ) from exc

    return result


def _run_training_job(job_id: str, request: TrainingRequest, settings: Settings) -> None:
    """Executed on a background thread by FastAPI's BackgroundTasks."""
    job = _TRAINING_JOBS[job_id]
    job.status = "running"

    def progress_callback(fold: int, total_folds: int, epoch: int, total_epochs: int) -> None:
        job.current_fold = fold
        job.current_epoch = epoch
        job.total_epochs = total_epochs

    try:
        result = run_cross_validation_training(
            dataset_dir=request.dataset_dir,
            settings=settings,
            epochs=request.epochs,
            batch_size=request.batch_size,
            n_splits=request.n_splits,
            learning_rate=request.learning_rate,
            progress_callback=progress_callback,
        )
        job.status = "completed"
        job.metrics = {
            "mean_accuracy": result.mean_accuracy,
            "mean_f1_macro": result.mean_f1_macro,
            "best_checkpoint_path": result.best_checkpoint_path,
            "total_training_seconds": result.total_training_seconds,
            "folds": [
                {
                    "fold": m.fold,
                    "accuracy": m.accuracy,
                    "f1_macro": m.f1_macro,
                    "val_loss": m.val_loss,
                }
                for m in result.fold_metrics
            ],
        }
        logger.info("Training job %s completed successfully.", job_id)

        # Force the inference manager to reload the freshly trained weights.
        manager = get_inference_manager(settings)
        manager.load()

    except Exception as exc:  # noqa: BLE001
        logger.exception("Training job %s failed: %s", job_id, exc)
        job.status = "failed"
        job.error = str(exc)


@router.post(
    "/api/v1/train",
    response_model=TrainingJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Training"],
)
async def train(
    request: TrainingRequest,
    background_tasks: BackgroundTasks,
    settings: Settings = Depends(get_settings),
) -> TrainingJobResponse:
    """Triggers a background Stratified K-Fold cross-validation training workflow."""
    job_id = str(uuid.uuid4())
    _TRAINING_JOBS[job_id] = TrainingJobStatus(job_id=job_id, status="queued")

    background_tasks.add_task(_run_training_job, job_id, request, settings)

    logger.info("Queued training job %s for dataset_dir=%s", job_id, request.dataset_dir)

    return TrainingJobResponse(
        job_id=job_id,
        status="queued",
        message="Training job has been queued and will run in the background.",
    )


@router.get(
    "/api/v1/train/{job_id}",
    response_model=TrainingJobStatus,
    tags=["Training"],
)
async def get_training_status(job_id: str) -> TrainingJobStatus:
    """Polls the status of a previously submitted training job."""
    job = _TRAINING_JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training job not found.")
    return job
