import { api } from "./client";

/**
 * "Send to Dermatologist": the server builds a PDF (patient details, the
 * stored image and AI result, medical history) and emails it to the doctor,
 * CCing the patient.
 *
 * Only `predictionId` is sent for the AI result: the server reads the image
 * and prediction it stored, so nothing is re-uploaded and the result can't be
 * altered on the way. `doctorEmail` must belong to an approved doctor.
 *
 * @param {{doctorEmail: string, predictionId: string,
 *          medicalHistory?: object, patientNote?: string}} consultation
 * @returns {Promise<{message: string}>}
 */
export function sendConsultation({ doctorEmail, predictionId, medicalHistory, patientNote }) {
  // PDF generation + SMTP can take several seconds.
  return api.post("/api/consultations", { doctorEmail, predictionId, medicalHistory, patientNote }, { timeoutMs: 60000 });
}
