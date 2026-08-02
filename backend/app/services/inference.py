"""
Thread-safe inference manager.

Loads model weights exactly once on application startup (or lazily on first
request), caches the state dict in memory, and exposes a single
`predict()` entry point that:
  1. Preprocesses the image + metadata.
  2. Runs a forward pass under `torch.no_grad()` to compute Top-K softmax
     probabilities.
  3. Runs a separate Grad-CAM pass (which requires gradients) to produce
     the explainability heatmap.

A `threading.Lock` guards model access so concurrent requests handled by
FastAPI's threadpool do not race on the same underlying `nn.Module`
(PyTorch modules are not guaranteed thread-safe for concurrent forward +
backward passes against shared buffers/hooks).
"""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F

from app.config import Settings
from app.services.explainability import GradCAM
from app.models.multimodal_net import MultiModalSkinNet, build_model
from app.schemas import ClassProbability, PatientMetadata, PredictionResponse
from app.services.preprocessing import (
    decode_image_bytes,
    encode_metadata,
    preprocess_image,
    validate_image_size,
    detect_ood_image,
)

logger = logging.getLogger(__name__)


def resolve_device(preference: str) -> torch.device:
    """Dynamically resolves the best available compute device."""
    preference = preference.lower()
    if preference == "cpu":
        return torch.device("cpu")
    if preference == "cuda":
        if torch.cuda.is_available():
            return torch.device("cuda")
        logger.warning("CUDA requested but not available; falling back to CPU.")
        return torch.device("cpu")
    if preference == "mps":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        logger.warning("MPS requested but not available; falling back to CPU.")
        return torch.device("cpu")

    # auto
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


class InferenceManager:
    """Singleton-style manager that owns the model instance and inference lock."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.device = resolve_device(settings.DEVICE_PREFERENCE)
        self._lock = threading.Lock()
        self._model: Optional[MultiModalSkinNet] = None
        self._gradcam: Optional[GradCAM] = None
        self._class_names: List[str] = list(settings.CLASS_NAMES)
        self._model_version: str = "uninitialized"
        self._loaded = False
        self._last_input_fingerprint: Optional[str] = None
        self._last_logits: Optional[np.ndarray] = None

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        """Loads (or re-loads) the model weights. Safe to call multiple times."""
        with self._lock:
            self._load_unlocked()

    def _load_unlocked(self) -> None:
        settings = self.settings
        model = build_model(
            num_classes=settings.NUM_CLASSES,
            metadata_input_dim=4,  # Explicitly set to 4 to match checkpoint shape [8, 4]
            backbone=settings.BACKBONE,
            # Never download or blend ImageNet weights into a trained checkpoint.
            pretrained=False,
        )

        weights_path: Path = settings.model_path
        if weights_path.exists():
            try:
                state_dict = torch.load(weights_path, map_location="cpu", weights_only=True)
                state_dict = state_dict.get("state_dict", state_dict)
                # Partial loading creates a hybrid model with random layers and is unsafe.
                model.load_state_dict(state_dict, strict=True)
                logger.info("Loaded all checkpoint weights from %s (strict=True)", weights_path)
                
                self._model_version = f"{settings.BACKBONE}:{weights_path.name}"
                
                frozen = [name for name, param in model.named_parameters() if not param.requires_grad]
                if frozen:
                    raise RuntimeError(f"Checkpoint model has frozen parameters: {frozen}")
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to load weights from %s: %s", weights_path, exc)
                self._model_version = f"{settings.BACKBONE}:random-init(load-failed)"
        else:
            logger.warning(
                "No trained weights found at %s. Refusing to serve random predictions.",
                weights_path,
            )
            raise FileNotFoundError(f"Required trained checkpoint not found: {weights_path}")

        model.to(self.device)
        model.eval()

        if settings.label_map_path.exists():
            try:
                with open(settings.label_map_path, "r", encoding="utf-8") as f:
                    label_map = json.load(f)
                ordered = sorted(label_map.items(), key=lambda kv: kv[1])
                self._class_names = [name for name, _ in ordered]
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to parse label map, using default class names: %s", exc)

        target_layer = model.get_target_layer()
        self._model = model
        self._gradcam = GradCAM(model=model, target_layer=target_layer)
        self._verify_model_is_input_sensitive(model)
        self._loaded = True

    def _verify_model_is_input_sensitive(self, model: MultiModalSkinNet) -> None:
        """Fail startup if distinct pixels cannot alter embeddings and logits."""
        size = self.settings.IMAGE_SIZE
        generator = torch.Generator(device=self.device).manual_seed(20260728)
        first = torch.randn((1, 3, size, size), generator=generator, device=self.device)
        second = torch.flip(first, dims=(3,))
        metadata = torch.zeros((1, 4), device=self.device)
        with torch.no_grad():
            logits_a, features_a = model.forward_with_features(first, metadata)
            logits_b, features_b = model.forward_with_features(second, metadata)
        feature_delta = float((features_a - features_b).abs().max().item())
        logit_delta = float((logits_a - logits_b).abs().max().item())
        if feature_delta <= 1e-7 or logit_delta <= 1e-7:
            raise RuntimeError("Model input-sensitivity check failed: distinct pixels produced identical features or logits.")
        logger.info("Model input-sensitivity check passed: feature_delta=%.8f logit_delta=%.8f", feature_delta, logit_delta)

    def _ensure_loaded(self) -> None:
        if not self._loaded:
            self.load()

    def predict(
        self,
        image_bytes: bytes,
        metadata: PatientMetadata,
        include_gradcam: bool = True,
    ) -> PredictionResponse:
        """Runs the full inference pipeline and returns a structured response."""
        self._ensure_loaded()
        start_time = time.perf_counter()
        request_id = str(uuid.uuid4())

        image_rgb = decode_image_bytes(image_bytes)
        validate_image_size(image_rgb)
        
        # OOD detection
        is_ood, ood_reason = detect_ood_image(image_rgb)
        if is_ood:
            # Return early with OOD flag set
            response = PredictionResponse(
                request_id=request_id,
                top_k=[],
                top1_label="",
                top1_probability=0.0,
                gradcam_base64=None,
                inference_time_ms=round((time.perf_counter() - start_time) * 1000.0, 2),
                model_version=self._model_version,
                device_used=str(self.device),
                is_ood=True,
                ood_reason=ood_reason,
            )
            logger.warning("OOD image detected: %s", ood_reason)
            return response

        image_tensor = preprocess_image(image_rgb, self.settings).to(self.device)
        metadata_tensor = encode_metadata(metadata, self.settings).to(self.device)

        with self._lock:
            assert self._model is not None and self._gradcam is not None

            with torch.no_grad():
                logits = self._model(image_tensor, metadata_tensor)
                probabilities = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

            if not torch.isfinite(logits).all() or not np.isclose(probabilities.sum(), 1.0, atol=1e-5):
                raise RuntimeError("Model produced invalid logits or a non-normalized probability distribution.")
            fingerprint = self._fingerprint(image_tensor, metadata_tensor)
            if self._last_input_fingerprint and fingerprint != self._last_input_fingerprint:
                delta = float(np.max(np.abs(logits.detach().cpu().numpy() - self._last_logits)))
                logger.info("Distinct request input observed; maximum logit delta=%.8f", delta)
                if delta <= 1e-7:
                    logger.warning("Distinct request inputs produced near-identical logits; review training data/checkpoint.")
            self._last_input_fingerprint = fingerprint
            self._last_logits = logits.detach().cpu().numpy().copy()

            logger.info(
                "Raw model outputs for request %s",
                request_id,
                extra={
                    "extra_fields": {
                        "request_id": request_id,
                        "raw_logits": logits.detach().cpu().numpy().tolist(),
                        "raw_probabilities": probabilities.tolist(),
                        "image_tensor_mean": image_tensor.mean().item(),
                        "image_tensor_std": image_tensor.std().item(),
                        "image_tensor_min": image_tensor.min().item(),
                        "image_tensor_max": image_tensor.max().item(),
                        "metadata_tensor": metadata_tensor.detach().cpu().numpy().tolist(),
                        "logits_sum": logits.sum().item(),
                        "logits_max": logits.max().item(),
                        "logits_min": logits.min().item(),
                    }
                },
            )

            top_k_indices, top_k_probs = self._top_k(probabilities, self.settings.TOP_K)

            gradcam_base64 = None
            if include_gradcam:
                try:
                    gradcam_base64, _ = self._gradcam.generate(
                        image_tensor=image_tensor,
                        metadata_tensor=metadata_tensor,
                        original_image_rgb=image_rgb,
                        target_class=int(top_k_indices[0]),
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Grad-CAM generation failed: %s", exc)
                    gradcam_base64 = None

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        top_k_payload = [
            ClassProbability(
                label=self._label_for_index(idx),
                probability=float(prob),
                rank=rank + 1,
            )
            for rank, (idx, prob) in enumerate(zip(top_k_indices, top_k_probs))
        ]

        response = PredictionResponse(
            request_id=request_id,
            top_k=top_k_payload,
            top1_label=top_k_payload[0].label,
            top1_probability=top_k_payload[0].probability,
            gradcam_base64=gradcam_base64,
            inference_time_ms=round(elapsed_ms, 2),
            model_version=self._model_version,
            device_used=str(self.device),
            is_ood=False,
            ood_reason=None,
        )

        logger.info(
            "Inference complete",
            extra={
                "extra_fields": {
                    "request_id": request_id,
                    "top1_label": response.top1_label,
                    "top1_probability": response.top1_probability,
                    "inference_time_ms": response.inference_time_ms,
                }
            },
        )
        return response

    def _label_for_index(self, idx: int) -> str:
        if 0 <= idx < len(self._class_names):
            return self._class_names[idx]
        return f"class_{idx}"

    @staticmethod
    def _top_k(probabilities: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
        k = min(k, len(probabilities))
        top_indices = np.argsort(probabilities)[::-1][:k]
        top_probs = probabilities[top_indices]
        return top_indices, top_probs

    @staticmethod
    def _fingerprint(image: torch.Tensor, metadata: torch.Tensor) -> str:
        import hashlib
        digest = hashlib.sha256()
        digest.update(image.detach().cpu().contiguous().numpy().tobytes())
        digest.update(metadata.detach().cpu().contiguous().numpy().tobytes())
        return digest.hexdigest()


_manager_instance: Optional[InferenceManager] = None
_manager_lock = threading.Lock()


def get_inference_manager(settings: Settings) -> InferenceManager:
    """Returns a process-wide singleton InferenceManager instance."""
    global _manager_instance
    if _manager_instance is None:
        with _manager_lock:
            if _manager_instance is None:
                _manager_instance = InferenceManager(settings)
    return _manager_instance
