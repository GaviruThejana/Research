/**
 * Maps a model prediction to a coarse clinical risk level for the PDF report,
 * e.g. "Melanoma" -> "High". Accepts HAM10000 class codes ("mel") and the
 * display names the app sends ("Melanoma"). Keep in sync with
 * mobile/src/constants/diseaseLabels.js.
 */
const RISK_BY_LABEL = {
  // Malignant
  mel: "High",
  melanoma: "High",
  bcc: "High",
  "basal cell carcinoma": "High",
  scc: "High",
  "squamous cell carcinoma": "High",
  // Pre-malignant / in situ
  akiec: "Moderate",
  "actinic keratosis / intraepithelial carcinoma": "Moderate",
  // Benign
  bkl: "Low",
  "benign keratosis": "Low",
  df: "Low",
  dermatofibroma: "Low",
  nv: "Low",
  "melanocytic nevus": "Low",
  vasc: "Low",
  "vascular lesion": "Low",
  benign: "Low",
};

/** @returns {"High"|"Moderate"|"Low"|"Unknown"} */
function getRiskLevel(prediction) {
  return RISK_BY_LABEL[String(prediction || "").trim().toLowerCase()] || "Unknown";
}

module.exports = { getRiskLevel };
