"""
Pydantic v2 data contracts for requests and responses.
"""
from __future__ import annotations

import time
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SexEnum(str, Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class AnatomicalSiteEnum(str, Enum):
    HEAD_NECK = "head/neck"
    UPPER_EXTREMITY = "upper extremity"
    LOWER_EXTREMITY = "lower extremity"
    TORSO = "torso"
    PALMS_SOLES = "palms/soles"
    ORAL_GENITAL = "oral/genital"
    UNKNOWN = "unknown"


class PatientMetadata(BaseModel):
    """Structured, clinically relevant metadata accompanying a lesion image."""

    model_config = ConfigDict(str_strip_whitespace=True)

    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    sex: SexEnum = Field(..., description="Patient biological sex")
    anatomical_site: AnatomicalSiteEnum = Field(
        ..., description="Anatomical site where the lesion was imaged"
    )

    @field_validator("age")
    @classmethod
    def _validate_age(cls, v: int) -> int:
        if v < 0 or v > 120:
            raise ValueError("age must be between 0 and 120")
        return v


class ClassProbability(BaseModel):
    """A single class label and its predicted probability."""

    label: str
    probability: float = Field(..., ge=0.0, le=1.0)
    rank: int = Field(..., ge=1)


class PredictionResponse(BaseModel):
    """Response returned by the /predict endpoint."""

    model_config = ConfigDict(protected_namespaces=())

    request_id: str
    top_k: List[ClassProbability]
    top1_label: str
    top1_probability: float
    gradcam_base64: Optional[str] = Field(
        default=None, description="Base64-encoded PNG of the Grad-CAM heatmap overlay"
    )
    inference_time_ms: float
    model_version: str
    device_used: str
    timestamp: float = Field(default_factory=lambda: time.time())
    is_ood: bool = Field(default=False, description="Whether the image was detected as out-of-distribution")
    ood_reason: Optional[str] = Field(default=None, description="Reason for OOD detection if applicable")


class TrainingRequest(BaseModel):
    """Payload used to trigger a background training job."""

    dataset_dir: str = Field(..., description="Path to the training dataset directory")
    epochs: Optional[int] = Field(default=None, ge=1, le=1000)
    batch_size: Optional[int] = Field(default=None, ge=1, le=1024)
    n_splits: Optional[int] = Field(default=None, ge=2, le=20)
    learning_rate: Optional[float] = Field(default=None, gt=0.0, le=1.0)


class TrainingJobResponse(BaseModel):
    """Response returned immediately after a training job is queued."""

    job_id: str
    status: str
    message: str


class TrainingJobStatus(BaseModel):
    """Polled status of a background training job."""

    job_id: str
    status: str
    current_fold: Optional[int] = None
    current_epoch: Optional[int] = None
    total_epochs: Optional[int] = None
    metrics: Optional[dict] = None
    error: Optional[str] = None


class ComponentHealth(BaseModel):
    name: str
    status: str
    detail: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """Response for liveness/readiness probes."""

    model_config = ConfigDict(protected_namespaces=())

    status: str
    version: str
    device: str
    model_loaded: bool
    uptime_seconds: float
    components: List[ComponentHealth] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    """Standard error envelope."""

    detail: str
    error_code: Optional[str] = None
    request_id: Optional[str] = None
