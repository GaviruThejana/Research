"""
Preprocessing pipeline for both image and structured metadata inputs.

Image pipeline: decode -> RGB conversion -> resize to model input size ->
ImageNet normalization -> tensor.

Metadata pipeline: age normalization + one-hot encoding of sex and
localization (anatomical site), concatenated into a single dense feature vector whose
dimensionality matches `Settings.metadata_vector_size`.

Metadata columns strictly matching training dataset: age, sex, localization.
"""
from __future__ import annotations

import io
import logging
from typing import List

import albumentations as A
import cv2
import numpy as np
import torch
from albumentations.pytorch import ToTensorV2
from PIL import Image

from app.config import Settings
from app.schemas import PatientMetadata, SexEnum

logger = logging.getLogger(__name__)

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def build_inference_transform(image_size: int) -> A.Compose:
    """Albumentations pipeline used at inference time (deterministic, no augmentation)."""
    return A.Compose(
        [
            A.Resize(height=image_size, width=image_size, interpolation=1),
            A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD, max_pixel_value=255.0),
            ToTensorV2(),
        ]
    )


def build_training_transform(image_size: int) -> A.Compose:
    """Albumentations pipeline used at training time, including light augmentation."""
    return A.Compose(
        [
            A.Resize(height=image_size, width=image_size, interpolation=1),
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.2),
            A.RandomBrightnessContrast(p=0.3),
            A.ShiftScaleRotate(
                shift_limit=0.05, scale_limit=0.1, rotate_limit=15, p=0.4
            ),
            A.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD, max_pixel_value=255.0),
            ToTensorV2(),
        ]
    )


def decode_image_bytes(raw_bytes: bytes) -> np.ndarray:
    """Decodes raw image bytes into an RGB uint8 numpy array."""
    try:
        pil_image = Image.open(io.BytesIO(raw_bytes))
        pil_image = pil_image.convert("RGB")
        return np.array(pil_image)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Unable to decode image: {exc}") from exc


def preprocess_image(
    image_rgb: np.ndarray, settings: Settings
) -> torch.Tensor:
    """Applies the inference transform and returns a batched tensor (1, 3, H, W)."""
    transform = build_inference_transform(settings.IMAGE_SIZE)
    transformed = transform(image=image_rgb)
    tensor = transformed["image"].unsqueeze(0).float()
    return tensor


def encode_metadata(metadata: PatientMetadata, settings: Settings) -> torch.Tensor:
    """
    Encodes structured metadata into a 4-dimensional feature vector to match checkpoint shape [8, 4]:
      [ normalized_age, sex_encoded, localization_encoded_1, localization_encoded_2 ]
    
    Encoding scheme:
    - age: normalized to [0, 1]
    - sex: 0.0 for female, 1.0 for male, 0.5 for unknown
    - localization: encoded as 2 dimensions based on anatomical site category
    """
    normalized_age = float(metadata.age) / settings.AGE_NORMALIZATION_MAX
    
    # Encode sex as single value: female=0.0, male=1.0, unknown=0.5
    if metadata.sex.value == SexEnum.FEMALE.value:
        sex_encoded = 0.0
    elif metadata.sex.value == SexEnum.MALE.value:
        sex_encoded = 1.0
    else:
        sex_encoded = 0.5
    
    # Encode localization as 2 dimensions based on anatomical site
    site_value = metadata.anatomical_site.value
    # Group anatomical sites into categories for 2D encoding
    # Category 0: head/neck, upper extremity
    # Category 1: lower extremity, torso
    # Category 2: palms/soles, oral/genital
    # Category 3: unknown
    if site_value in ["head/neck", "upper extremity"]:
        loc_1, loc_2 = 0.0, 0.0
    elif site_value in ["lower extremity", "torso"]:
        loc_1, loc_2 = 1.0, 0.0
    elif site_value in ["palms/soles", "oral/genital"]:
        loc_1, loc_2 = 0.0, 1.0
    else:  # unknown
        loc_1, loc_2 = 1.0, 1.0
    
    vector = [normalized_age, sex_encoded, loc_1, loc_2]
    tensor = torch.tensor(vector, dtype=torch.float32).unsqueeze(0)
    return tensor


def validate_image_size(image_rgb: np.ndarray, min_dim: int = 32) -> None:
    """Raises ValueError if the decoded image is degenerate (too small / empty)."""
    if image_rgb is None or image_rgb.size == 0:
        raise ValueError("Decoded image is empty.")
    h, w = image_rgb.shape[:2]
    if h < min_dim or w < min_dim:
        raise ValueError(
            f"Image dimensions too small ({w}x{h}); minimum {min_dim}x{min_dim} required."
        )


def detect_ood_image(image_rgb: np.ndarray) -> tuple[bool, str | None]:
    """
    Detects Out-of-Distribution (OOD) images that are not suitable for skin lesion analysis.
    
    Checks for:
    - Extreme blur (using Laplacian variance)
    - Low contrast (using standard deviation of pixel intensities)
    - Unusual aspect ratios (non-lesion images)
    
    Returns:
        (is_ood: bool, reason: str | None)
    """
    try:
        # Check for blur using Laplacian variance
        gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Threshold for blur detection (empirically determined)
        if laplacian_var < 50:
            return True, "Image appears too blurry. Please upload a clear, focused photo."
        
        # Check for low contrast
        contrast = gray.std()
        if contrast < 30:
            return True, "Image has low contrast. Please ensure good lighting."
        
        # Check aspect ratio (skin lesions are typically not extremely wide or tall)
        h, w = image_rgb.shape[:2]
        aspect_ratio = max(w, h) / min(w, h)
        if aspect_ratio > 5:
            return True, "Unusual image aspect ratio. Please upload a close-up of the lesion."
        
        return False, None
    except Exception as exc:  # noqa: BLE001
        # If OOD detection fails, allow the image to proceed
        logger.warning("OOD detection failed: %s. Allowing image to proceed.", exc)
        return False, None
