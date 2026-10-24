import { api, imageFormPart } from "./client";

/**
 * Classifies a lesion photo: POST /api/predictions on the Node API (JWT
 * attached), which forwards to the FastAPI model and stores the result.
 *
 * @param {{uri: string, mimeType?: string}} image from expo-image-picker
 * @param {{age?: number, sex?: string, anatomical_site?: string}} [metadata]
 * @returns {Promise<{id: string, isOod: boolean, oodReason?: string, label: string,
 *   displayName: string, confidence: number, riskLevel: string, imageUrl: string}>}
 */
export async function predictLesion(image, metadata = {}) {
  const form = new FormData();
  form.append("image", imageFormPart(image.uri, image.mimeType));
  form.append("metadata", JSON.stringify(metadata));

  // Inference can take a while on CPU, so allow longer than the default.
  const { prediction } = await api.post("/api/predictions", form, { timeoutMs: 90000 });
  return prediction;
}
