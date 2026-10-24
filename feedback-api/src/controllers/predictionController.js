const mongoose = require("mongoose");
const { Prediction } = require("../models");
const { HttpError } = require("../middleware/errorHandler");
const { saveImage, publicBaseUrl } = require("../middleware/upload");
const { classifyImage } = require("../services/aiClient");
const { getRiskLevel } = require("../services/riskLevel");

const MAX_GRADCAM_CHARS = 10_000_000;

function normalizeGradcam(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.length > MAX_GRADCAM_CHARS) {
    console.warn(`[prediction] Grad-CAM omitted: payload too large (${candidate.length} characters)`);
    return null;
  }
  const uri = candidate.startsWith("data:image/")
    ? candidate
    : `data:image/png;base64,${candidate}`;
  const match = uri.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    console.warn("[prediction] Grad-CAM omitted: FastAPI returned an unsupported or malformed image payload");
    return null;
  }
  return uri;
}

/**
 * POST /api/predictions   (multipart/form-data, JWT required)
 * Fields: image (JPEG/PNG), metadata? (JSON: { age, sex, anatomical_site })
 *
 * Forwards the image to the FastAPI classifier, stores the result and the
 * image, and returns the saved prediction. Out-of-distribution images (not a
 * skin lesion) are returned with isOod: true and not stored.
 */
async function createPrediction(req, res) {
  if (!req.file) throw new HttpError(400, "image is required");

  let metadata = {};
  if (req.body?.metadata) {
    try {
      metadata = JSON.parse(req.body.metadata);
    } catch (_err) {
      throw new HttpError(400, "metadata must be valid JSON");
    }
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new HttpError(400, "metadata must be a JSON object");
  }

  if (metadata.age !== undefined && metadata.age !== null && (typeof metadata.age !== "number" || !Number.isFinite(metadata.age) || metadata.age < 0 || metadata.age > 120)) {
    throw new HttpError(400, "metadata.age must be a number between 0 and 120");
  }
  if (metadata.sex !== undefined && (typeof metadata.sex !== "string" || metadata.sex.length > 32)) {
    throw new HttpError(400, "metadata.sex must be a short string");
  }
  if (metadata.anatomical_site !== undefined && (typeof metadata.anatomical_site !== "string" || metadata.anatomical_site.length > 64)) {
    throw new HttpError(400, "metadata.anatomical_site must be a short string");
  }
  const allowedSites = new Set(["head/neck", "upper extremity", "lower extremity", "torso", "palms/soles", "oral/genital", "unknown"]);
  if (metadata.anatomical_site && !allowedSites.has(metadata.anatomical_site)) {
    throw new HttpError(400, "metadata.anatomical_site is not supported");
  }

  const ai = await classifyImage(req.file, metadata);
  const gradcamBase64 = normalizeGradcam(ai.gradcam_base64);
  if (!gradcamBase64) console.warn("[prediction] FastAPI response contained no usable Grad-CAM image");

  if (ai.is_ood) {
    return res.status(200).json({
      prediction: { isOod: true, oodReason: ai.ood_reason || "This doesn't look like a skin lesion photo." },
    });
  }

  const label = ai.top1_label || ai.predicted_class;
  if (!label) {
    console.error("[ai] Unexpected FastAPI response shape:", Object.keys(ai));
    throw new HttpError(502, "The AI service returned an unexpected response.");
  }
  const displayName = ai.predicted_disease_name || label;

  const imagePath = await saveImage(req.file); // "/uploads/<sha256>.jpg"
  const prediction = await Prediction.create({
    user: req.user.id,
    imageUrl: publicBaseUrl(req) + imagePath,
    imageFile: imagePath.replace("/uploads/", ""),
    label,
    displayName,
    confidence: ai.top1_probability ?? ai.confidence,
    riskLevel: getRiskLevel(label),
    topK: (ai.top_k || []).map((item) => ({
      label: item.label,
      displayName: item.disease_name,
      probability: item.probability,
    })),
    modelVersion: ai.model_version,
    inferenceTimeMs: ai.inference_time_ms,
    patientDetails: {
      ...(metadata.age !== undefined && { age: metadata.age }),
      ...(metadata.sex && { sex: metadata.sex }),
      ...(metadata.anatomical_site && { anatomical_site: metadata.anatomical_site }),
    },
    gradcamBase64: gradcamBase64 || undefined,
  });

  console.log(`[prediction] user=${req.user.id} ${displayName} (${(prediction.confidence * 100).toFixed(1)}%, ${prediction.riskLevel} risk) id=${prediction._id}`);
  res.status(201).json({ prediction: toClient(prediction) });
}

/** GET /api/predictions — the logged-in user's recent predictions. */
async function listMyPredictions(req, res) {
  const predictions = await Prediction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50);
  res.json({ data: predictions.map(toClient) });
}

/** GET /api/predictions/:id/heatmap — owner-scoped Grad-CAM image. */
async function getPredictionHeatmap(req, res) {
  if (!mongoose.isValidObjectId(req.params.predictionId)) throw new HttpError(400, "Invalid predictionId");
  const prediction = await Prediction.findOne({ _id: req.params.predictionId, user: req.user.id }).select("+gradcamBase64");
  if (!prediction) throw new HttpError(404, "Prediction not found");
  if (!prediction.gradcamBase64) throw new HttpError(404, "Heatmap is unavailable for this result");
  res.set("Cache-Control", "private, no-store").json({ data: prediction.gradcamBase64 });
}

/**
 * Loads a prediction that belongs to the current user (404 otherwise, so
 * other users' prediction ids can't be probed).
 */
async function findOwnPrediction(predictionId, userId) {
  if (!mongoose.isValidObjectId(predictionId)) throw new HttpError(400, "Invalid predictionId");
  const prediction = await Prediction.findOne({ _id: predictionId, user: userId });
  if (!prediction) throw new HttpError(404, "Prediction not found");
  return prediction;
}

function toClient(p) {
  return {
    id: p._id.toString(),
    isOod: false,
    label: p.label,
    displayName: p.displayName,
    confidence: p.confidence,
    riskLevel: p.riskLevel,
    topK: p.topK,
    patientDetails: p.patientDetails,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt,
  };
}

module.exports = { createPrediction, listMyPredictions, getPredictionHeatmap, findOwnPrediction };
