"""
Shared pytest fixtures for the test suite.
"""
from __future__ import annotations

import io
import os
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

# Ensure `app` package is importable when tests are run from the backend/ root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("SKINAI_BACKBONE", "mobilenet_v3_large")
os.environ.setdefault("SKINAI_DEVICE_PREFERENCE", "cpu")
os.environ.setdefault("SKINAI_NUM_CLASSES", "7")

from app.config import Settings, get_settings  # noqa: E402


@pytest.fixture(scope="session")
def test_settings(tmp_path_factory) -> Settings:
    """Isolated settings instance pointing at a temporary weights directory."""
    get_settings.cache_clear()
    tmp_dir = tmp_path_factory.mktemp("weights")
    settings = Settings(
        MODEL_DIR=tmp_dir,
        BACKBONE="mobilenet_v3_large",
        DEVICE_PREFERENCE="cpu",
        NUM_CLASSES=7,
    )
    return settings


@pytest.fixture
def sample_image_bytes() -> bytes:
    """Generates a small synthetic RGB image as PNG bytes."""
    array = (np.random.rand(256, 256, 3) * 255).astype(np.uint8)
    image = Image.fromarray(array, mode="RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def sample_metadata_json() -> str:
    import json

    return json.dumps({"age": 45, "sex": "female", "anatomical_site": "torso"})
