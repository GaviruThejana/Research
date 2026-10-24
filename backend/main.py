"""
FastAPI Backend for Skin Disease Classification
Multimodal Deep Learning Pipeline (MobileNetV3 + Metadata Metrology + Random Forest Meta-Model)

Run locally:
    python main.py
or:
    uvicorn main:app --host 0.0.0.0 --port 8001 --reload

The Node API (feedback-api/src/services/aiClient.js) calls POST /api/v1/predict;
apps never call this service directly.
Structured app package (uvicorn app.main:app) exposes the same path; this module
also implements /api/v1/predict for compatibility when using the multimodal main.py stack.
"""

import os
import io
import base64
import time
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

# Prevent Windows libiomp5md duplicate OpenMP runtime error
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import cv2
import joblib
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as tv_models
from PIL import Image

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("skin_disease_api")

# ---------------------------------------------------------------------------
# 1. Weights Directory & Model Artifact Paths
# ---------------------------------------------------------------------------
# Resolved relative to this file so it works on any machine / inside Docker;
# override with SKINAI_MODEL_DIR if the weights live elsewhere.
BASE_WEIGHTS_DIR = Path(
    os.environ.get("SKINAI_MODEL_DIR") or Path(__file__).resolve().parent / "weights"
)

FINAL_MODEL_PT = BASE_WEIGHTS_DIR / "final_model.pt"
FINAL_RF_JOBLIB = BASE_WEIGHTS_DIR / "final_rf_meta.joblib"
PREPROCESSING_CONFIG_JSON = BASE_WEIGHTS_DIR / "preprocessing_config.json"
PREPROCESSING_MANIFEST_JSON = BASE_WEIGHTS_DIR / "preprocessing_manifest.json"

PHASE1_MODEL_PT = BASE_WEIGHTS_DIR / "phase1_best_model.pt"
PHASE1_HAM_PT = BASE_WEIGHTS_DIR / "phase1_best_ham.pt"
PHASE1_RF_JOBLIB = BASE_WEIGHTS_DIR / "phase1_best_model.joblib"
PHASE1_HAM_RF = BASE_WEIGHTS_DIR / "phase1_best_ham_rf_meta.joblib"

PHASE2_MODEL_PT = BASE_WEIGHTS_DIR / "phase2_best_model.pt"
PHASE2_PAD_PT = BASE_WEIGHTS_DIR / "phase2_best_pad.pt"
PHASE2_RF_JOBLIB = BASE_WEIGHTS_DIR / "phase2_best_model.joblib"
PHASE2_PAD_RF = BASE_WEIGHTS_DIR / "phase2_best_pad_rf_meta.joblib"

# Default class mapping & disease full names
DEFAULT_HAM_CLASSES = [
    "akiec",
    "bcc",
    "bkl",
    "df",
    "mel",
    "nv",
    "vasc"
]

DISEASE_FULL_NAMES = {
    "akiec": "Actinic Keratoses and Intraepithelial Carcinoma",
    "bcc": "Basal Cell Carcinoma",
    "bkl": "Benign Keratosis-like Lesions",
    "df": "Dermatofibroma",
    "mel": "Melanoma",
    "nv": "Melanocytic Nevi",
    "vasc": "Vascular Lesions"
}

# ImageNet normalization parameters
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# ---------------------------------------------------------------------------
# 2. Pydantic Response Schemas
# ---------------------------------------------------------------------------
class ProbabilityItem(BaseModel):
    class_index: int
    label: str
    disease_name: str
    probability: float
    rank: Optional[int] = 1

class MetaFeaturesResponse(BaseModel):
    ita: float
    hue_angle: float
    skin_tone_category: str
    ita_provided_by_user: bool
    hue_provided_by_user: bool
    patient_age: Optional[float] = None
    patient_sex: Optional[str] = None
    anatomical_site: Optional[str] = None

class PredictionResponse(BaseModel):
    # Allow the `model_version` field without Pydantic's "model_" namespace warning.
    model_config = ConfigDict(protected_namespaces=())

    success: bool = True
    pipeline: str
    predicted_class: str
    predicted_disease_name: str
    class_index: int
    confidence: float
    probabilities: Dict[str, float]
    ranked_probabilities: List[ProbabilityItem]
    top_k: List[ProbabilityItem]
    top1_label: str
    top1_probability: float
    gradcam_base64: Optional[str] = None
    meta_features: MetaFeaturesResponse
    pytorch_cnn_probabilities: Dict[str, float]
    rf_meta_probabilities: Dict[str, float]
    inference_time_ms: float
    device: str
    device_used: Optional[str] = None
    model_version: Optional[str] = None
    request_id: Optional[str] = None
    is_ood: bool = False
    ood_reason: Optional[str] = None

class JsonPredictRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image string")
    ita: Optional[float] = Field(None, description="Individual Typology Angle (ITA)")
    hue: Optional[float] = Field(None, description="Mean Hue Angle")
    age: Optional[float] = Field(None, description="Patient age in years")
    sex: Optional[str] = Field(None, description="Patient sex ('male', 'female', etc.)")
    phase: Optional[str] = Field("final", description="'final', 'phase1', or 'phase2'")


# ---------------------------------------------------------------------------
# 3. Model Architecture Builder
# ---------------------------------------------------------------------------
def build_mobilenet_extractor(num_classes: int = 7) -> tv_models.MobileNetV3:
    """
    Constructs MobileNetV3-Large matching checkpoint configuration:
      - features: MobileNetV3-Large backbone
      - avgpool: AdaptiveAvgPool2d((1, 1))
      - classifier:
          (0): Linear(960, 1280)
          (1): Hardswish()
          (2): Dropout(p=0.2)
          (3): Linear(1280, num_classes)
    """
    model = tv_models.mobilenet_v3_large(weights=None)
    model.classifier[3] = nn.Linear(1280, num_classes)
    return model


# ---------------------------------------------------------------------------
# 4. Global State Container
# ---------------------------------------------------------------------------
class ModelRegistry:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.config: Dict[str, Any] = {}
        self.ham_classes: List[str] = DEFAULT_HAM_CLASSES
        self.img_size: int = 224
        self.apply_dullrazor: bool = False

        # Models
        self.final_model: Optional[tv_models.MobileNetV3] = None
        self.final_rf: Optional[Any] = None

        self.phase1_model: Optional[tv_models.MobileNetV3] = None
        self.phase1_rf: Optional[Any] = None

        self.phase2_model: Optional[tv_models.MobileNetV3] = None
        self.phase2_rf: Optional[Any] = None

        self.loaded: bool = False

    def load_all(self):
        logger.info(f"Using compute device: {self.device}")
        logger.info(f"Loading weights and configurations from: {BASE_WEIGHTS_DIR}")

        # 1. Load Preprocessing Configuration
        config_path = PREPROCESSING_CONFIG_JSON if PREPROCESSING_CONFIG_JSON.exists() else PREPROCESSING_MANIFEST_JSON
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
            self.ham_classes = self.config.get("ham_classes", DEFAULT_HAM_CLASSES)
            self.img_size = self.config.get("img_size", 224)
            self.apply_dullrazor = self.config.get("apply_dullrazor", False)
            logger.info(f"Loaded config from {config_path.name} | classes={self.ham_classes} | img_size={self.img_size}")
        else:
            logger.warning("No preprocessing config file found; using defaults.")

        num_classes = len(self.ham_classes)

        # 2. Load Final PyTorch Model
        if FINAL_MODEL_PT.exists():
            self.final_model = build_mobilenet_extractor(num_classes)
            state_dict = torch.load(FINAL_MODEL_PT, map_location=self.device, weights_only=True)
            self.final_model.load_state_dict(state_dict, strict=True)
            self.final_model.to(self.device)
            self.final_model.eval()
            logger.info("Successfully loaded final_model.pt (strict=True)")
        else:
            raise FileNotFoundError(f"Missing required model weights: {FINAL_MODEL_PT}")

        # 3. Load Final Random Forest Meta-Model
        if FINAL_RF_JOBLIB.exists():
            self.final_rf = joblib.load(FINAL_RF_JOBLIB)
            logger.info(
                f"Successfully loaded final_rf_meta.joblib (trees={len(self.final_rf.estimators_)}, "
                f"features_in={self.final_rf.n_features_in_})"
            )
        else:
            raise FileNotFoundError(f"Missing required Random Forest meta-model: {FINAL_RF_JOBLIB}")

        # 4. Load Phase 1 Model & RF (HAM10000)
        p1_pt = PHASE1_MODEL_PT if PHASE1_MODEL_PT.exists() else PHASE1_HAM_PT
        p1_rf = PHASE1_RF_JOBLIB if PHASE1_RF_JOBLIB.exists() else PHASE1_HAM_RF
        if p1_pt.exists() and p1_rf.exists():
            try:
                self.phase1_model = build_mobilenet_extractor(num_classes)
                self.phase1_model.load_state_dict(torch.load(p1_pt, map_location=self.device, weights_only=True), strict=True)
                self.phase1_model.to(self.device).eval()
                self.phase1_rf = joblib.load(p1_rf)
                logger.info(f"Loaded Phase 1 models from {p1_pt.name} and {p1_rf.name}")
            except Exception as e:
                logger.warning(f"Could not load Phase 1 model: {e}")

        # 5. Load Phase 2 Model & RF (PAD-UFES-20)
        p2_pt = PHASE2_MODEL_PT if PHASE2_MODEL_PT.exists() else PHASE2_PAD_PT
        p2_rf = PHASE2_RF_JOBLIB if PHASE2_RF_JOBLIB.exists() else PHASE2_PAD_RF
        if p2_pt.exists() and p2_rf.exists():
            try:
                self.phase2_model = build_mobilenet_extractor(num_classes)
                self.phase2_model.load_state_dict(torch.load(p2_pt, map_location=self.device, weights_only=True), strict=True)
                self.phase2_model.to(self.device).eval()
                self.phase2_rf = joblib.load(p2_rf)
                logger.info(f"Loaded Phase 2 models from {p2_pt.name} and {p2_rf.name}")
            except Exception as e:
                logger.warning(f"Could not load Phase 2 model: {e}")

        self.loaded = True
        logger.info("All startup weights and models initialized successfully.")


registry = ModelRegistry()

# ---------------------------------------------------------------------------
# 5. Image & Color Metrology Preprocessing Logic
# ---------------------------------------------------------------------------
def apply_dullrazor(img: np.ndarray) -> np.ndarray:
    """Blackhat morphological filtering and inpainting for hair artifact removal."""
    gray_scale = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (17, 17))
    blackhat = cv2.morphologyEx(gray_scale, cv2.MORPH_BLACKHAT, kernel)
    _, thresh = cv2.threshold(blackhat, 10, 255, cv2.THRESH_BINARY)
    return cv2.inpaint(img, thresh, 1, cv2.INPAINT_TELEA)


def apply_color_constancy(img: np.ndarray, p: int = 6) -> np.ndarray:
    """Shades-of-Gray color constancy algorithm to correct illumination bias."""
    img_float = np.array(img, dtype=np.float32)
    img_power = np.power(img_float, p)
    rgb_vec = np.power(np.mean(img_power, axis=(0, 1)), 1.0 / p)
    rgb_norm = np.sqrt(np.sum(np.square(rgb_vec)))
    rgb_vec = rgb_vec / (rgb_norm + 1e-8)
    rgb_vec = 1.0 / (rgb_vec + 1e-8)
    rgb_vec = rgb_vec / np.max(rgb_vec)
    return np.clip(img_float * rgb_vec, 0, 255).astype(np.uint8)


def calculate_color_metrology(img: np.ndarray) -> tuple[float, float]:
    """
    Computes Individual Typology Angle (ITA) and Mean Hue Angle:
      - CIELAB: L* scaled to [0, 100], b* centered around 0
      - ITA = arctan((L - 50) / b) * (180 / pi)
      - Normalized ITA = (ITA + 90) / 180  (scale [0, 1])
      - Normalized Hue = Mean(H) / 180     (scale [0, 1])
    """
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    L, _, b = cv2.split(lab)
    L = L * (100.0 / 255.0)
    b = b - 128.0

    ita_vals = (np.arctan2(L - 50.0, b + 1e-6) * 180.0) / np.pi
    ita_mean = float(np.mean(ita_vals))
    ita_norm = float((ita_mean + 90.0) / 180.0)

    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
    H, _, _ = cv2.split(hsv)
    hue_mean = float(np.mean(H))
    hue_norm = float(hue_mean / 180.0)

    return ita_norm, hue_norm


def classify_skin_tone_ita(ita_norm: float) -> str:
    """
    Classifies skin tone category based on ITA angle:
      ITA_deg = (ita_norm * 180) - 90
    """
    ita_deg = (ita_norm * 180.0) - 90.0
    if ita_deg > 55.0:
        return "Very Light (Fitzpatrick I)"
    elif ita_deg > 41.0:
        return "Light (Fitzpatrick II)"
    elif ita_deg > 28.0:
        return "Intermediate (Fitzpatrick III)"
    elif ita_deg > 10.0:
        return "Tan (Fitzpatrick IV)"
    elif ita_deg > -30.0:
        return "Brown (Fitzpatrick V)"
    else:
        return "Dark (Fitzpatrick VI)"


def preprocess_image_tensor(img_rgb: np.ndarray, target_size: int, use_dullrazor: bool = False) -> torch.Tensor:
    """
    Applies preprocessing defined in configuration:
      1. Optional DullRazor
      2. Resize to target size (224x224)
      3. Standard ImageNet mean/std normalization
      4. Convert to PyTorch Tensor [1, 3, H, W]
    """
    img = img_rgb.copy()
    if use_dullrazor:
        img = apply_dullrazor(img)

    resized = cv2.resize(img, (target_size, target_size), interpolation=cv2.INTER_AREA)
    norm_img = resized.astype(np.float32) / 255.0
    norm_img = (norm_img - IMAGENET_MEAN) / IMAGENET_STD

    tensor = torch.from_numpy(norm_img).permute(2, 0, 1).unsqueeze(0).float()
    return tensor


def generate_gradcam_overlay(model: tv_models.MobileNetV3, image_tensor: torch.Tensor, original_image_rgb: np.ndarray, target_class: int) -> Optional[str]:
    """Generates a Grad-CAM heatmap overlay for the predicted class."""
    h_fwd = None
    h_bwd = None
    try:
        target_layer = model.features[-1]
        activations = None
        gradients = None

        def save_activation(_m, _inp, out):
            nonlocal activations
            activations = out.detach()

        def save_gradient(_m, _g_in, g_out):
            nonlocal gradients
            gradients = g_out[0].detach()

        h_fwd = target_layer.register_forward_hook(save_activation)
        h_bwd = target_layer.register_full_backward_hook(save_gradient)

        # Clone input tensor with gradient tracking
        img_var = image_tensor.clone().detach().requires_grad_(True)
        model.zero_grad()
        output = model(img_var)

        if target_class >= output.shape[1]:
            target_class = 0
        score = output[0, target_class]
        score.backward()

        if activations is None or gradients is None:
            return None

        weights = torch.mean(gradients, dim=[2, 3], keepdim=True)
        cam = torch.sum(weights * activations, dim=1).squeeze()
        cam = torch.relu(cam).cpu().numpy()
        cam_range = float(cam.max() - cam.min())
        if cam_range > 0:
            cam = (cam - cam.min()) / cam_range
        else:
            cam = np.zeros_like(cam)

        h, w = original_image_rgb.shape[:2]
        cam_resized = cv2.resize(cam, (w, h), interpolation=cv2.INTER_LINEAR)
        cam_uint8 = np.clip(np.rint(cam_resized * 255.0), 0, 255).astype(np.uint8)
        heatmap_bgr = cv2.applyColorMap(cam_uint8, cv2.COLORMAP_JET)

        orig_bgr = cv2.cvtColor(original_image_rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
        overlay = cv2.addWeighted(orig_bgr, 0.60, heatmap_bgr, 0.40, 0)
        ok, png = cv2.imencode(".png", overlay)
        if not ok:
            return None
        return "data:image/png;base64," + base64.b64encode(png.tobytes()).decode("ascii")
    except Exception as exc:
        logger.warning(f"Grad-CAM generation failed: {exc}")
        return None
    finally:
        # Always remove hooks, including when a forward/backward pass fails.
        if h_fwd is not None:
            h_fwd.remove()
        if h_bwd is not None:
            h_bwd.remove()


# ---------------------------------------------------------------------------
# 6. Core Inference Pipeline Execution
# ---------------------------------------------------------------------------
def run_multimodal_inference(
    img_rgb: np.ndarray,
    user_ita: Optional[float] = None,
    user_hue: Optional[float] = None,
    user_age: Optional[float] = None,
    user_sex: Optional[str] = None,
    phase: str = "final",
    include_gradcam: bool = True
) -> Dict[str, Any]:
    """
    Full multimodal inference execution:
      1. Computes or validates ITA & Hue metadata.
      2. Preprocesses image for MobileNetV3.
      3. Extracts 1280-dim deep feature embeddings and 7-dim softmax class probabilities.
      4. Concatenates features into the 1287-dimensional meta-feature representation.
      5. Runs Random Forest meta-model prediction.
      6. Maps predictions to probabilities and disease categories.
    """
    import uuid

    # 1. Color Metrology & Metadata Processing
    calc_ita, calc_hue = calculate_color_metrology(img_rgb)

    ita_used = float(user_ita) if user_ita is not None else calc_ita
    hue_used = float(user_hue) if user_hue is not None else calc_hue
    skin_tone_desc = classify_skin_tone_ita(ita_used)

    # 2. Select appropriate model pair
    phase_clean = (phase or "final").strip().lower()
    if phase_clean == "phase1" and registry.phase1_model is not None and registry.phase1_rf is not None:
        pt_model = registry.phase1_model
        rf_model = registry.phase1_rf
        active_pipeline = "Phase 1 (HAM10000 Benchmark)"
    elif phase_clean == "phase2" and registry.phase2_model is not None and registry.phase2_rf is not None:
        pt_model = registry.phase2_model
        rf_model = registry.phase2_rf
        active_pipeline = "Phase 2 (PAD-UFES-20 Benchmark)"
    else:
        pt_model = registry.final_model
        rf_model = registry.final_rf
        active_pipeline = "Final Production Multimodal Model"

    if pt_model is None or rf_model is None:
        raise RuntimeError("Inference models are not initialized.")

    # 3. Image Preprocessing
    image_tensor = preprocess_image_tensor(
        img_rgb,
        target_size=registry.img_size,
        use_dullrazor=registry.apply_dullrazor
    ).to(registry.device)

    # 4. PyTorch Feature Extraction & CNN Logits
    with torch.no_grad():
        # MobileNet features -> avgpool -> flatten -> 960 features
        feats_960 = torch.flatten(pt_model.avgpool(pt_model.features(image_tensor)), 1)
        # Penultimate layer: classifier[:3] -> Linear(960, 1280) + Hardswish + Dropout
        feats_1280 = pt_model.classifier[:3](feats_960)
        # Final logits -> Linear(1280, 7)
        logits = pt_model.classifier[3](feats_1280)
        cnn_probs = F.softmax(logits, dim=1).cpu().numpy().squeeze(0)  # shape (7,)

    feats_1280_np = feats_1280.cpu().numpy()  # shape (1, 1280)
    cnn_probs_np = cnn_probs.reshape(1, -1)   # shape (1, 7)

    # 5. Multimodal Meta-Feature Combination (1280 image features + 7 class probabilities = 1287 features)
    combined_features = np.hstack([feats_1280_np, cnn_probs_np])

    # 6. Random Forest Meta-Model Classification
    rf_pred_index = int(rf_model.predict(combined_features)[0])
    rf_probabilities = rf_model.predict_proba(combined_features)[0]  # shape (7,)

    predicted_label = registry.ham_classes[rf_pred_index]
    predicted_disease = DISEASE_FULL_NAMES.get(predicted_label, predicted_label)
    top_confidence = float(rf_probabilities[rf_pred_index])

    # 7. Formulate structured probabilities
    class_prob_dict = {
        label: float(rf_probabilities[i])
        for i, label in enumerate(registry.ham_classes)
    }

    cnn_prob_dict = {
        label: float(cnn_probs[i])
        for i, label in enumerate(registry.ham_classes)
    }

    ranked_items = [
        ProbabilityItem(
            class_index=int(i),
            label=registry.ham_classes[i],
            disease_name=DISEASE_FULL_NAMES.get(registry.ham_classes[i], registry.ham_classes[i]),
            probability=float(rf_probabilities[i]),
            rank=int(rank + 1)
        )
        for rank, i in enumerate(np.argsort(rf_probabilities)[::-1])
    ]

    # Generate Grad-CAM visualization
    gradcam_base64 = None
    if include_gradcam:
        gradcam_base64 = generate_gradcam_overlay(pt_model, image_tensor, img_rgb, rf_pred_index)

    return {
        "request_id": str(uuid.uuid4()),
        "pipeline": active_pipeline,
        "predicted_class": predicted_label,
        "predicted_disease_name": predicted_disease,
        "class_index": rf_pred_index,
        "confidence": top_confidence,
        "top1_label": predicted_label,
        "top1_probability": top_confidence,
        "top_k": ranked_items[:3],
        "probabilities": class_prob_dict,
        "ranked_probabilities": ranked_items,
        "gradcam_base64": gradcam_base64,
        "meta_features": MetaFeaturesResponse(
            ita=round(ita_used, 4),
            hue_angle=round(hue_used, 4),
            skin_tone_category=skin_tone_desc,
            ita_provided_by_user=user_ita is not None,
            hue_provided_by_user=user_hue is not None,
            patient_age=user_age,
            patient_sex=user_sex,
        ),
        "pytorch_cnn_probabilities": cnn_prob_dict,
        "rf_meta_probabilities": class_prob_dict,
        "model_version": f"MobileNetV3+RF ({active_pipeline})",
        "device_used": str(registry.device),
        "device": str(registry.device),
        "is_ood": False,
        "ood_reason": None,
    }


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load PyTorch models, Random Forest meta-models, and configuration at startup."""
    logger.info("Initializing ModelRegistry on application startup...")
    try:
        registry.load_all()
    except Exception as exc:
        logger.error(f"Failed to load weights during startup: {exc}", exc_info=True)
        raise RuntimeError(f"Startup initialization failed: {exc}")
    yield
    logger.info("Application shutdown complete.")

# ---------------------------------------------------------------------------
# 7. FastAPI Application Definition
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Skin Disease Multimodal Classification API",
    version="1.0.0",
    description=(
        "Production FastAPI backend for skin disease diagnosis using PyTorch MobileNetV3 "
        "feature extraction, adaptive color metrology (ITA & Hue), and a Random Forest meta-model."
    ),
    lifespan=lifespan
)

# Enable CORS for Frontend apps (React, Vue, mobile, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["System"])
async def root():
    return {
        "status": "online",
        "service": "Skin Disease Classification API",
        "version": "1.0.0",
        "device": str(registry.device),
        "weights_dir": str(BASE_WEIGHTS_DIR),
        "classes": registry.ham_classes,
        "docs": "/docs"
    }


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "healthy" if registry.loaded else "unhealthy",
        "models_loaded": {
            "final_model": registry.final_model is not None,
            "final_rf_meta": registry.final_rf is not None,
            "phase1_available": registry.phase1_model is not None,
            "phase2_available": registry.phase2_model is not None,
        },
        "device": str(registry.device),
        "classes_count": len(registry.ham_classes)
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict_endpoint(
    image: UploadFile = File(..., description="Uploaded skin lesion image (JPEG, PNG, etc.)"),
    ita: Optional[float] = Form(None, description="Optional Individual Typology Angle (0.0 to 1.0 or raw deg)"),
    hue: Optional[float] = Form(None, description="Optional Hue angle (0.0 to 1.0)"),
    age: Optional[float] = Form(None, description="Optional patient age"),
    sex: Optional[str] = Form(None, description="Optional patient sex ('male', 'female', etc.)"),
    phase: Optional[str] = Form("final", description="Model version: 'final', 'phase1', or 'phase2'")
):
    """
    Primary multimodal skin disease classification endpoint via multipart/form-data.
    Accepts image file and optional clinical / color metrology metadata.
    """
    start_time = time.perf_counter()

    if not registry.loaded:
        registry.load_all()

    # 1. Read & Validate image file
    try:
        raw_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img_rgb = np.array(pil_img)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupt image file: {str(exc)}"
        )

    if img_rgb.size == 0 or img_rgb.shape[0] < 32 or img_rgb.shape[1] < 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too small ({img_rgb.shape[1]}x{img_rgb.shape[0]}); minimum size 32x32 required."
        )

    # 2. Normalize ITA input if user provided raw angle in degrees [-90, +90]
    processed_ita = ita
    if processed_ita is not None and (processed_ita < 0 or processed_ita > 1.0):
        # Convert [-90, 90] degrees to [0, 1] normalized
        processed_ita = (float(processed_ita) + 90.0) / 180.0

    # 3. Execute inference pipeline
    try:
        results = run_multimodal_inference(
            img_rgb=img_rgb,
            user_ita=processed_ita,
            user_hue=hue,
            user_age=age,
            user_sex=sex,
            phase=phase
        )
    except Exception as exc:
        logger.error(f"Inference pipeline execution error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(exc)}"
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return PredictionResponse(
        success=True,
        inference_time_ms=elapsed_ms,
        **results
    )


@app.post("/api/v1/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict_v1_endpoint(
    image: UploadFile = File(..., description="Lesion image file (JPEG/PNG/WebP)"),
    metadata: str = Form(
        ..., description='JSON metadata: {"age": number, "sex": "male"|"female", "anatomical_site": string}'
    ),
    include_gradcam: bool = Form(default=True),
    phase: Optional[str] = Form("final", description="Model version: 'final', 'phase1', or 'phase2'"),
):
    """
    Prediction route used by the Node API (feedback-api/src/services/aiClient.js); same contract as app/api/routes.py.
    Accepts multipart image + JSON patient metadata. The current deployed
    classifier predicts from the image; patient metadata is preserved in the
    response for the Node API record and clinician report.
    """
    start_time = time.perf_counter()

    if not registry.loaded:
        registry.load_all()

    try:
        metadata_dict = json.loads(metadata)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid metadata JSON: {exc}",
        ) from exc

    user_age = metadata_dict.get("age")
    user_sex = metadata_dict.get("sex")
    if user_age is not None:
        try:
            user_age = float(user_age)
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="metadata.age must be a number",
            ) from exc

    try:
        raw_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
        img_rgb = np.array(pil_img)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or corrupt image file: {str(exc)}",
        )

    if img_rgb.size == 0 or img_rgb.shape[0] < 32 or img_rgb.shape[1] < 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image too small ({img_rgb.shape[1]}x{img_rgb.shape[0]}); minimum size 32x32 required.",
        )

    try:
        results = run_multimodal_inference(
            img_rgb=img_rgb,
            user_age=user_age,
            user_sex=str(user_sex) if user_sex is not None else None,
            phase=phase,
            include_gradcam=include_gradcam,
        )
    except Exception as exc:
        logger.error(f"Inference pipeline execution error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(exc)}",
        )

    # The current deployed classifier uses image features only. Preserve the
    # full patient context in the response for the Node API record and report.
    results["meta_features"].anatomical_site = metadata_dict.get("anatomical_site")

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return PredictionResponse(
        success=True,
        inference_time_ms=elapsed_ms,
        **results,
    )


@app.post("/predict_json", response_model=PredictionResponse, tags=["Inference"])
async def predict_json_endpoint(request_data: JsonPredictRequest):
    """
    Alternative classification endpoint accepting JSON payload with Base64 encoded image.
    """
    import base64

    start_time = time.perf_counter()

    if not registry.loaded:
        registry.load_all()

    # 1. Decode Base64 image
    try:
        b64_str = request_data.image_base64
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_str)
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_rgb = np.array(pil_img)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to decode base64 image: {str(exc)}"
        )

    # 2. Normalize ITA if in degrees
    processed_ita = request_data.ita
    if processed_ita is not None and (processed_ita < 0 or processed_ita > 1.0):
        processed_ita = (float(processed_ita) + 90.0) / 180.0

    # 3. Execute inference
    try:
        results = run_multimodal_inference(
            img_rgb=img_rgb,
            user_ita=processed_ita,
            user_hue=request_data.hue,
            user_age=request_data.age,
            user_sex=request_data.sex,
            phase=request_data.phase or "final"
        )
    except Exception as exc:
        logger.error(f"Inference pipeline execution error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {str(exc)}"
        )

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return PredictionResponse(
        success=True,
        inference_time_ms=elapsed_ms,
        **results
    )


# ---------------------------------------------------------------------------
# 8. Main Entrypoint for Local Execution
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 70)
    print("Starting Skin Disease Classification FastAPI Service")
    print(f"Weights Directory: {BASE_WEIGHTS_DIR}")
    print("=" * 70 + "\n")
    # 8001 by default: 8000 is often taken on Windows (WinError 10013).
    port = int(os.environ.get("SKINAI_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
