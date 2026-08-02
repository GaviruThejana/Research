"""
Integration tests for the FastAPI application using TestClient.
"""
from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def _make_png_bytes(size=(256, 256)) -> bytes:
    image = Image.new("RGB", size, color=(120, 80, 60))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert "service" in body
    assert "docs_url" in body


def test_health_endpoint_schema():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()

    assert body["status"] in {"healthy", "degraded"}
    assert "version" in body
    assert "device" in body
    assert "model_loaded" in body
    assert isinstance(body["components"], list)


def test_predict_endpoint_returns_valid_schema():
    image_bytes = _make_png_bytes()
    metadata = {"age": 40, "sex": "male", "anatomical_site": "torso"}

    response = client.post(
        "/api/v1/predict",
        files={"image": ("lesion.png", image_bytes, "image/png")},
        data={"metadata": json.dumps(metadata), "include_gradcam": "true"},
    )

    assert response.status_code == 200
    body = response.json()

    assert "top_k" in body and len(body["top_k"]) > 0
    assert "top1_label" in body
    assert 0.0 <= body["top1_probability"] <= 1.0
    assert "gradcam_base64" in body
    assert "inference_time_ms" in body
    assert "model_version" in body
    assert "device_used" in body

    for entry in body["top_k"]:
        assert "label" in entry
        assert "probability" in entry
        assert "rank" in entry


def test_predict_endpoint_rejects_bad_content_type():
    response = client.post(
        "/api/v1/predict",
        files={"image": ("notes.txt", b"hello world", "text/plain")},
        data={"metadata": json.dumps({"age": 30, "sex": "male", "anatomical_site": "torso"})},
    )
    assert response.status_code == 400


def test_predict_endpoint_rejects_invalid_metadata():
    image_bytes = _make_png_bytes()
    response = client.post(
        "/api/v1/predict",
        files={"image": ("lesion.png", image_bytes, "image/png")},
        data={"metadata": json.dumps({"age": -5, "sex": "male", "anatomical_site": "torso"})},
    )
    assert response.status_code == 422


def test_predict_endpoint_rejects_empty_image():
    response = client.post(
        "/api/v1/predict",
        files={"image": ("lesion.png", b"", "image/png")},
        data={"metadata": json.dumps({"age": 30, "sex": "male", "anatomical_site": "torso"})},
    )
    assert response.status_code == 400


def test_train_endpoint_queues_job(tmp_path):
    dataset_dir = tmp_path / "dataset"
    dataset_dir.mkdir()

    response = client.post(
        "/api/v1/train",
        json={"dataset_dir": str(dataset_dir), "epochs": 1, "batch_size": 2, "n_splits": 2},
    )
    assert response.status_code == 202
    body = response.json()
    assert "job_id" in body
    assert body["status"] == "queued"

    status_response = client.get(f"/api/v1/train/{body['job_id']}")
    assert status_response.status_code == 200
    assert status_response.json()["job_id"] == body["job_id"]


def test_train_status_not_found():
    response = client.get("/api/v1/train/nonexistent-job-id")
    assert response.status_code == 404
