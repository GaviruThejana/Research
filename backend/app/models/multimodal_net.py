"""MobileNetV3 image encoder and metadata fusion classifier.

The module layout deliberately matches ``mobilenet_fine_tuned.pth``.  It
returns *logits* (never probabilities); softmax belongs at the API boundary.
"""
from __future__ import annotations

from typing import Tuple

import torch
from torch import nn
import torchvision.models as tv_models


class MultiModalSkinNet(nn.Module):
    """MobileNetV3-Large (960 features) fused with four metadata features."""

    def __init__(
        self,
        num_classes: int = 7,
        metadata_input_dim: int = 4,
        backbone: str = "mobilenetv3_large",
        pretrained: bool = False,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        if backbone.lower().replace("_", "") != "mobilenetv3large":
            raise ValueError("Only mobilenetv3_large is supported by this checkpoint.")
        if metadata_input_dim != 4:
            raise ValueError("The trained fusion model requires exactly four metadata values.")

        weights = tv_models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        mobilenet = tv_models.mobilenet_v3_large(weights=weights)
        # These names and dimensions are checkpoint-compatible; do not rename them.
        self.features = mobilenet.features
        self.pool = nn.AdaptiveAvgPool2d((1, 1))
        self.meta_mlp = nn.Sequential(
            nn.Linear(4, 8), nn.BatchNorm1d(8), nn.ReLU(inplace=True),
            nn.Linear(8, 16), nn.BatchNorm1d(16), nn.ReLU(inplace=True),
        )
        self.classifier = nn.Sequential(
            nn.Linear(976, 256), nn.BatchNorm1d(256), nn.ReLU(inplace=True),
            nn.Dropout(dropout), nn.Linear(256, num_classes),
        )
        self.num_classes = num_classes
        self.backbone = backbone

    def _validate_inputs(self, image: torch.Tensor, metadata: torch.Tensor) -> None:
        if image.ndim != 4 or image.shape[1] != 3:
            raise ValueError(f"Expected image tensor [N, 3, H, W], received {tuple(image.shape)}.")
        if metadata.ndim != 2 or metadata.shape != (image.shape[0], 4):
            raise ValueError(f"Expected metadata tensor [N, 4], received {tuple(metadata.shape)}.")
        if not torch.isfinite(image).all() or not torch.isfinite(metadata).all():
            raise ValueError("Image and metadata tensors must contain only finite values.")

    def extract_image_features(self, image: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Return the final convolutional feature map and its pooled embedding."""
        feature_map = self.features(image)
        return feature_map, torch.flatten(self.pool(feature_map), 1)

    def forward_with_features(self, image: torch.Tensor, metadata: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        self._validate_inputs(image, metadata)
        feature_map, image_embedding = self.extract_image_features(image)
        fused = torch.cat((image_embedding, self.meta_mlp(metadata)), dim=1)
        return self.classifier(fused), feature_map

    def forward(self, image: torch.Tensor, metadata: torch.Tensor) -> torch.Tensor:
        logits, _ = self.forward_with_features(image, metadata)
        return logits

    def get_target_layer(self) -> nn.Module:
        """Last MobileNet feature block, whose output feeds global pooling."""
        return self.features[-1]


MultiModalMobileNet = MultiModalSkinNet


def build_model(num_classes: int, metadata_input_dim: int = 4, backbone: str = "mobilenetv3_large", pretrained: bool = False) -> MultiModalSkinNet:
    return MultiModalSkinNet(num_classes, metadata_input_dim, backbone, pretrained)
