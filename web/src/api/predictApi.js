import { api, appendImage } from "./client";

/**
 * Classifies a lesion photo: POST /api/predictions on the Node API (JWT
 * attached), which forwards to the FastAPI model and stores the result.
 *
 * @param {File|Blob} image JPEG/PNG
 * @param {{age?: number, sex?: string, anatomical_site?: string}} [metadata]
 * @returns {Promise<{id: string, isOod: boolean, oodReason?: string, label: string,
 *   displayName: string, confidence: number, riskLevel: string, imageUrl: string}>}
 */
export async function predictLesion(image, metadata = {}) {
  const form = new FormData();
  appendImage(form, image);
  form.append("metadata", JSON.stringify(metadata));

  // Inference can take a while on CPU, so allow longer than the default.
  const { prediction } = await api.post("/api/predictions", form, { timeoutMs: 150000 });
  return prediction;
}

/**
 * The user's recent predictions (newest first). Web-only use: reloads a
 * result after a page refresh, when the in-memory navigation state is gone.
 */
export async function fetchMyPredictions() {
  const { data } = await api.get("/api/predictions");
  return data;
}

/** Fetches the owner-scoped Grad-CAM image through the Node API. */
export async function fetchPredictionHeatmap(predictionId) {
  const result = await api.get(`/api/predictions/${encodeURIComponent(predictionId)}/heatmap`);
  const value = typeof result === "string" ? result : result?.data;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Node API returned an empty Grad-CAM payload.");
  }
  if (value.startsWith("data:image/png;base64,") || value.startsWith("data:image/jpeg;base64,")) return value;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return `data:image/png;base64,${value}`;
  throw new Error("Node API returned an unsupported Grad-CAM image format.");
}
