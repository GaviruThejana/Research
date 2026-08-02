const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/**
 * Submits an image + patient metadata to the prediction endpoint.
 * @param {File} imageFile
 * @param {{age: number, sex: string, anatomical_site: string}} metadata
 * @param {boolean} includeGradcam
 * @returns {Promise<object>} PredictionResponse
 */
export async function predictLesion(imageFile, metadata, includeGradcam = true) {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("include_gradcam", String(includeGradcam));

  const response = await fetch(`${API_BASE_URL}/api/v1/predict`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || detail;
    } catch (_err) {
      // response body wasn't JSON; keep the default message
    }
    throw new Error(detail);
  }

  return response.json();
}

/**
 * Fetches backend health/readiness status.
 * @returns {Promise<object>} HealthCheckResponse
 */
export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Triggers a background training job.
 * @param {{dataset_dir: string, epochs?: number, batch_size?: number, n_splits?: number, learning_rate?: number}} payload
 */
export async function triggerTraining(payload) {
  const response = await fetch(`${API_BASE_URL}/api/v1/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = `Training request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail || detail;
    } catch (_err) {
      // ignore parse failure
    }
    throw new Error(detail);
  }

  return response.json();
}

/**
 * Polls the status of a background training job.
 * @param {string} jobId
 */
export async function fetchTrainingStatus(jobId) {
  const response = await fetch(`${API_BASE_URL}/api/v1/train/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch training status (status ${response.status})`);
  }
  return response.json();
}
