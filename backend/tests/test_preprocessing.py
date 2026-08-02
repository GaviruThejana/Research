"""
Unit tests for image/metadata preprocessing transforms.
"""
from __future__ import annotations

import numpy as np
import pytest
import torch

from app.schemas import AnatomicalSiteEnum, PatientMetadata, SexEnum
from app.services.preprocessing import (
    decode_image_bytes,
    encode_metadata,
    preprocess_image,
    validate_image_size,
)


def test_decode_image_bytes_returns_rgb_array(sample_image_bytes):
    array = decode_image_bytes(sample_image_bytes)
    assert isinstance(array, np.ndarray)
    assert array.ndim == 3
    assert array.shape[2] == 3


def test_decode_image_bytes_raises_on_garbage():
    with pytest.raises(ValueError):
        decode_image_bytes(b"not-an-image")


def test_validate_image_size_accepts_normal_image():
    image = np.zeros((224, 224, 3), dtype=np.uint8)
    validate_image_size(image)  # should not raise


def test_validate_image_size_rejects_tiny_image():
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    with pytest.raises(ValueError):
        validate_image_size(image)


def test_preprocess_image_output_shape(test_settings):
    image = (np.random.rand(300, 300, 3) * 255).astype(np.uint8)
    tensor = preprocess_image(image, test_settings)

    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (1, 3, test_settings.IMAGE_SIZE, test_settings.IMAGE_SIZE)
    assert tensor.dtype == torch.float32


def test_encode_metadata_vector_length(test_settings):
    metadata = PatientMetadata(age=50, sex=SexEnum.MALE, anatomical_site=AnatomicalSiteEnum.TORSO)
    tensor = encode_metadata(metadata, test_settings)

    assert tensor.shape == (1, test_settings.metadata_vector_size)


def test_encode_metadata_age_is_normalized(test_settings):
    metadata = PatientMetadata(
        age=test_settings.AGE_NORMALIZATION_MAX, sex=SexEnum.FEMALE, anatomical_site=AnatomicalSiteEnum.UNKNOWN
    )
    tensor = encode_metadata(metadata, test_settings)
    assert 0.0 <= tensor[0, 0].item() <= 1.0
    assert abs(tensor[0, 0].item() - 1.0) < 1e-6


def test_encode_metadata_one_hot_sums_to_one(test_settings):
    metadata = PatientMetadata(age=10, sex=SexEnum.MALE, anatomical_site=AnatomicalSiteEnum.HEAD_NECK)
    tensor = encode_metadata(metadata, test_settings)

    sex_segment = tensor[0, 1:4]
    site_segment = tensor[0, 4:]

    assert torch.isclose(sex_segment.sum(), torch.tensor(1.0))
    assert torch.isclose(site_segment.sum(), torch.tensor(1.0))
