/**
 * Ground-truth labels a doctor may select. Keep in sync with
 * feedback-api/src/config/labels.js (the server rejects anything else).
 */
export const DISEASE_LABELS = [
  { value: "Melanoma", label: "Melanoma" },
  { value: "BCC", label: "Basal Cell Carcinoma (BCC)" },
  { value: "SCC", label: "Squamous Cell Carcinoma (SCC)" },
  { value: "Benign", label: "Benign" },
];

/** Display names for the HAM10000 class codes returned by the classifier. */
export const MODEL_CLASS_NAMES = {
  akiec: "Actinic Keratosis / Intraepithelial Carcinoma",
  bcc: "Basal Cell Carcinoma",
  bkl: "Benign Keratosis",
  df: "Dermatofibroma",
  mel: "Melanoma",
  nv: "Melanocytic Nevus",
  vasc: "Vascular Lesion",
};

export function formatModelLabel(code) {
  return MODEL_CLASS_NAMES[String(code).toLowerCase()] || code;
}

/**
 * Coarse risk level per class, shown next to the prediction ("Melanoma - High Risk").
 * Keep in sync with feedback-api/src/services/riskLevel.js (used in the PDF).
 */
const RISK_BY_CODE = { mel: "High", bcc: "High", scc: "High", akiec: "Moderate", bkl: "Low", df: "Low", nv: "Low", vasc: "Low" };

/** @returns {"High"|"Moderate"|"Low"|null} */
export function getRiskLevel(code) {
  return RISK_BY_CODE[String(code).toLowerCase()] || null;
}
