const { HttpError } = require("../middleware/errorHandler");

// FastAPI should listen on localhost only; phones reach it through this API.
const FASTAPI_URL = (process.env.FASTAPI_URL || "http://127.0.0.1:8001").replace(/\/+$/, "");
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000);

/**
 * Sends an image to the FastAPI classifier (POST /api/v1/predict) and returns
 * its JSON response. Maps every failure mode to an HttpError with a message
 * that is safe to show to app users.
 *
 * @param {{buffer: Buffer, mimetype: string, originalname?: string}} file multer file
 * @param {{age?: number, sex?: string, anatomical_site?: string}} metadata
 */
async function classifyImage(file, metadata = {}) {
  const form = new FormData();
  form.append("image", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "lesion.jpg");
  form.append("metadata", JSON.stringify(metadata));
  // Return Grad-CAM with the prediction so it can be stored against the
  // authenticated prediction record and fetched later without rerunning AI.
  form.append("include_gradcam", "true");

  let response;
  try {
    response = await fetch(`${FASTAPI_URL}/api/v1/predict`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    console.error(`[ai] FastAPI ${timedOut ? "timed out" : "unreachable"} at ${FASTAPI_URL}:`, err.cause?.code || err.message);
    throw new HttpError(
      timedOut ? 504 : 503,
      timedOut
        ? "The AI service took too long to respond. Please try again."
        : "The AI service is not available right now. Please try again shortly."
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_err) {
    const contentType = response.headers.get("content-type") || "unknown";
    console.error(`[ai] FastAPI returned non-JSON response: status=${response.status}, content-type=${contentType}`);
    if (response.ok) {
      throw new HttpError(502, "The AI service returned an invalid response format. Expected JSON prediction data with an optional Grad-CAM image.");
    }
  }

  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail || body);
    console.error(`[ai] FastAPI returned ${response.status}: ${detail}`);
    // 4xx from FastAPI means the image itself was rejected (corrupt, too small...).
    // Only pass through the "too small" message; other details are Python internals.
    if (response.status >= 400 && response.status < 500) {
      throw new HttpError(
        422,
        /too small/i.test(detail)
          ? "The photo is too small. Please take a closer, higher-resolution picture of the lesion."
          : "The photo couldn't be read. Please upload a clear JPEG or PNG image."
      );
    }
    throw new HttpError(502, "The AI service failed to analyse the image. Please try again.");
  }

  if (typeof body?.gradcam_base64 !== "string") {
    console.warn(`[ai] FastAPI prediction response has no gradcam_base64 string (status=${response.status})`);
  }

  return body;
}

module.exports = { classifyImage, FASTAPI_URL };
