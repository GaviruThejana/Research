"""
Unit tests for the multi-modal model and Grad-CAM explainability engine.
"""
from __future__ import annotations

import numpy as np
import torch
import base64

from app.models.explainability import GradCAM
from app.models.multimodal_net import MultiModalSkinNet, build_model


def test_model_forward_pass_output_shape(test_settings):
    model = build_model(
        num_classes=test_settings.NUM_CLASSES,
        metadata_input_dim=test_settings.metadata_vector_size,
        backbone="mobilenet_v3_large",
        pretrained=False,
    )
    model.eval()

    dummy_image = torch.randn(2, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE)
    dummy_meta = torch.randn(2, test_settings.metadata_vector_size)

    with torch.no_grad():
        logits = model(dummy_image, dummy_meta)

    assert logits.shape == (2, test_settings.NUM_CLASSES)


def test_model_forward_with_features_returns_feature_map(test_settings):
    model = build_model(
        num_classes=test_settings.NUM_CLASSES,
        metadata_input_dim=test_settings.metadata_vector_size,
        backbone="mobilenet_v3_large",
        pretrained=False,
    )
    model.eval()

    dummy_image = torch.randn(1, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE)
    dummy_meta = torch.randn(1, test_settings.metadata_vector_size)

    logits, feature_map = model.forward_with_features(dummy_image, dummy_meta)

    assert logits.shape == (1, test_settings.NUM_CLASSES)
    assert feature_map.ndim == 4
    assert feature_map.shape[0] == 1


def test_distinct_images_produce_distinct_features_logits_and_probabilities(test_settings):
    model = build_model(7, test_settings.metadata_vector_size, "mobilenet_v3_large", pretrained=False)
    model.eval()
    generator = torch.Generator().manual_seed(8)
    first = torch.randn(1, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE, generator=generator)
    second = torch.flip(first, dims=(3,))
    metadata = torch.zeros(1, test_settings.metadata_vector_size)
    with torch.no_grad():
        logits_a, features_a = model.forward_with_features(first, metadata)
        logits_b, features_b = model.forward_with_features(second, metadata)
        probabilities = torch.softmax(logits_b, dim=1)
    assert not torch.equal(features_a, features_b)
    assert not torch.equal(logits_a, logits_b)
    assert torch.allclose(probabilities.sum(dim=1), torch.ones(1), atol=1e-6)


def test_batchnorm_requires_batch_size_gt_one_is_handled_in_eval(test_settings):
    """BatchNorm layers require eval() mode for single-sample inference."""
    model = build_model(
        num_classes=test_settings.NUM_CLASSES,
        metadata_input_dim=test_settings.metadata_vector_size,
        backbone="mobilenet_v3_large",
        pretrained=False,
    )
    model.eval()

    dummy_image = torch.randn(1, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE)
    dummy_meta = torch.randn(1, test_settings.metadata_vector_size)

    with torch.no_grad():
        logits = model(dummy_image, dummy_meta)

    assert logits.shape == (1, test_settings.NUM_CLASSES)


def test_gradcam_generates_valid_base64_png(test_settings):
    model = build_model(
        num_classes=test_settings.NUM_CLASSES,
        metadata_input_dim=test_settings.metadata_vector_size,
        backbone="mobilenet_v3_large",
        pretrained=False,
    )
    model.eval()

    target_layer = model.get_target_layer()
    gradcam = GradCAM(model=model, target_layer=target_layer)

    image_tensor = torch.randn(1, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE)
    meta_tensor = torch.randn(1, test_settings.metadata_vector_size)
    original_image = (np.random.rand(test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE, 3) * 255).astype(np.uint8)

    encoded, target_class = gradcam.generate(image_tensor, meta_tensor, original_image)

    assert isinstance(encoded, str)
    assert encoded.startswith("data:image/png;base64,")
    assert len(base64.b64decode(encoded.split(",", 1)[1])) > 100
    assert isinstance(target_class, int)
    assert 0 <= target_class < test_settings.NUM_CLASSES

    gradcam.remove_hooks()
