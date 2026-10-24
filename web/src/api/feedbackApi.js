import { api } from "./client";

/**
 * Flags a prediction as incorrect for expert review. Doctors may include the
 * correct label; the server rejects it from anyone else.
 *
 * @param {{predictionId: string, doctorLabel?: string}} report
 * @returns {Promise<object>} the saved FlaggedPrediction
 */
export async function submitFeedbackReport({ predictionId, doctorLabel }) {
  const { data } = await api.post("/api/feedback/report", { predictionId, doctorLabel });
  return data;
}
