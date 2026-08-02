"""Grad-CAM generation for the image branch of the multimodal classifier."""
from __future__ import annotations

import base64
import logging
from typing import Optional

import cv2
import numpy as np
import torch
from torch import nn

logger = logging.getLogger(__name__)
_PNG_DATA_URI = "data:image/png;base64,"


class GradCAM:
    """One-request-at-a-time Grad-CAM implementation (the manager provides locking)."""

    def __init__(self, model: nn.Module, target_layer: nn.Module) -> None:
        self.model = model
        self.target_layer = target_layer
        self._activations: Optional[torch.Tensor] = None
        self._gradients: Optional[torch.Tensor] = None
        self._forward_handle = target_layer.register_forward_hook(self._capture_activations)

    def _capture_activations(self, _module: nn.Module, _inputs: tuple, output: torch.Tensor) -> None:
        # Normal inference runs under no_grad; only Grad-CAM passes need a
        # gradient hook.  Registering unconditionally breaks ordinary scoring.
        if output.requires_grad:
            self._activations = output
            output.register_hook(self._capture_gradients)

    def _capture_gradients(self, gradients: torch.Tensor) -> None:
        self._gradients = gradients

    def remove_hooks(self) -> None:
        self._forward_handle.remove()

    def generate(self, image_tensor: torch.Tensor, metadata_tensor: torch.Tensor, original_image_rgb: np.ndarray, target_class: Optional[int] = None, alpha: float = 0.40) -> tuple[str, int]:
        """Return a PNG data URI showing a JET heatmap blended over original RGB pixels."""
        if original_image_rgb.ndim != 3 or original_image_rgb.shape[2] != 3:
            raise ValueError("Grad-CAM requires an HxWx3 RGB image.")
        if not 0.0 <= alpha <= 1.0:
            raise ValueError("Grad-CAM alpha must be between 0 and 1.")

        self._activations = self._gradients = None
        self.model.zero_grad(set_to_none=True)
        logits = self.model(image_tensor, metadata_tensor)
        used_class = int(logits.argmax(dim=1).item()) if target_class is None else target_class
        if not 0 <= used_class < logits.shape[1]:
            raise ValueError(f"Invalid Grad-CAM class index {used_class}.")
        logits[:, used_class].sum().backward()

        if self._activations is None or self._gradients is None:
            raise RuntimeError("Grad-CAM did not receive final-convolution activations and gradients.")
        activations, gradients = self._activations[0], self._gradients[0]
        channel_weights = gradients.mean(dim=(1, 2), keepdim=True)
        weighted_activations = (channel_weights * activations).sum(dim=0)
        cam = torch.relu(weighted_activations).detach().float().cpu().numpy()
        cam_range = float(cam.max() - cam.min())
        if not np.isfinite(cam_range) or cam_range == 0.0:
            # A class can have wholly negative evidence at this layer.  Preserve
            # spatial attribution in that rare case rather than emitting a solid
            # JET image; magnitude is still derived from the actual gradient.
            cam = weighted_activations.abs().detach().float().cpu().numpy()
            cam_range = float(cam.max() - cam.min())
            if not np.isfinite(cam_range) or cam_range == 0.0:
                raise RuntimeError("Grad-CAM is uniform; no spatial explanation is available.")
            logger.warning("Grad-CAM used absolute-gradient fallback for class %d.", used_class)
        cam = (cam - cam.min()) / cam_range

        height, width = original_image_rgb.shape[:2]
        cam = cv2.resize(cam, (width, height), interpolation=cv2.INTER_LINEAR)
        cam_uint8 = np.clip(np.rint(cam * 255.0), 0, 255).astype(np.uint8)
        heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)
        original_bgr = cv2.cvtColor(original_image_rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
        overlay_rgb = cv2.cvtColor(cv2.addWeighted(original_bgr, 1.0 - alpha, heatmap_bgr, alpha, 0), cv2.COLOR_BGR2RGB)
        ok, png = cv2.imencode(".png", cv2.cvtColor(overlay_rgb, cv2.COLOR_RGB2BGR))
        if not ok:
            raise RuntimeError("OpenCV could not encode the Grad-CAM PNG.")
        data_uri = _PNG_DATA_URI + base64.b64encode(png.tobytes()).decode("ascii")
        logger.info("Grad-CAM produced class=%d map=%s range=[%d,%d]", used_class, cam.shape, int(cam_uint8.min()), int(cam_uint8.max()))
        return data_uri, used_class
