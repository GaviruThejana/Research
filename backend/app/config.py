"""
Application configuration module.

Centralizes all environment-driven configuration using pydantic-settings.
Values can be overridden via environment variables or a `.env` file placed
in the backend working directory.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SKINAI_",
        case_sensitive=False,
        extra="ignore",
    )

    # --- General application metadata -------------------------------------------------
    APP_NAME: str = Field(default="Skin Disease Classification API")
    APP_VERSION: str = Field(default="1.0.0")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)

    # --- Server ------------------------------------------------------------------------
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)

    # --- CORS --------------------------------------------------------------------------
    CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:80",
        ]
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # --- Model / Inference ---------------------------------------------------------------
    MODEL_DIR: Path = Field(default=Path("./weights"))
    MODEL_FILENAME: str = Field(default="mobilenet_fine_tuned.pth")
    LABEL_MAP_FILENAME: str = Field(default="label_map.json")

    BACKBONE: str = Field(default="mobilenetv3_large", description="resnet50 | efficientnet_b0 | mobilenetv3_large")
    NUM_CLASSES: int = Field(default=7)
    TOP_K: int = Field(default=3)
    IMAGE_SIZE: int = Field(default=224)

    DEVICE_PREFERENCE: str = Field(
        default="auto", description="auto | cpu | cuda | mps"
    )

    # --- Metadata encoding ---------------------------------------------------------------
    # sex: {female, male, unknown} -> one-hot (3)
    # anatomical site: fixed vocabulary -> one-hot (N)
    ANATOMICAL_SITES: List[str] = Field(
        default_factory=lambda: [
            "head/neck",
            "upper extremity",
            "lower extremity",
            "torso",
            "palms/soles",
            "oral/genital",
            "unknown",
        ]
    )
    AGE_NORMALIZATION_MAX: float = Field(default=100.0)

    # --- Class labels (ordered, index-aligned with model output) -----------------------
    CLASS_NAMES: List[str] = Field(
        default_factory=lambda: [
            "nv",
            "mel",
            "bkl",
            "bcc",
            "akiec",
            "vasc",
            "df",
        ]
    )

    @field_validator("CLASS_NAMES", "ANATOMICAL_SITES", mode="before")
    @classmethod
    def _split_list(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    # --- Training ------------------------------------------------------------------------
    TRAIN_DATA_DIR: Path = Field(default=Path("./data"))
    CHECKPOINT_DIR: Path = Field(default=Path("./checkpoints"))
    BATCH_SIZE: int = Field(default=32)
    EPOCHS: int = Field(default=10)
    N_SPLITS: int = Field(default=5)
    LEARNING_RATE: float = Field(default=1e-3)
    NUM_WORKERS: int = Field(default=2)
    RANDOM_SEED: int = Field(default=42)

    # --- Logging ---------------------------------------------------------------------------
    LOG_LEVEL: str = Field(default="INFO")

    @property
    def model_path(self) -> Path:
        return self.MODEL_DIR / self.MODEL_FILENAME

    @property
    def label_map_path(self) -> Path:
        return self.MODEL_DIR / self.LABEL_MAP_FILENAME

    @property
    def metadata_vector_size(self) -> int:
        # Fixed to 4 to match checkpoint shape [8, 4] for meta_mlp.0.weight
        # Metadata encoding: age(1) + sex(1) + localization(2) = 4
        return 4


@lru_cache
def get_settings() -> Settings:
    """Returns a cached singleton instance of Settings."""
    settings = Settings()
    settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    settings.CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    return settings
