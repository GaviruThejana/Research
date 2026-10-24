const mongoose = require("mongoose");

/**
 * One AI classification run by a logged-in user. Stored server-side so later
 * steps (doctor reports, feedback) reference this record instead of trusting
 * prediction text sent back by the client.
 */
const predictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: true },
    // File name inside feedback-api/uploads, used to embed the image in PDFs.
    imageFile: { type: String, required: true },
    label: { type: String, required: true }, // model class code, e.g. "mel"
    displayName: { type: String, required: true }, // e.g. "Melanoma"
    confidence: { type: Number, min: 0, max: 1 },
    riskLevel: { type: String, enum: ["High", "Moderate", "Low", "Unknown"], required: true },
    topK: [{ _id: false, label: String, displayName: String, probability: Number }],
    patientDetails: {
      age: { type: Number, min: 0, max: 120 },
      sex: { type: String, maxlength: 32 },
      anatomical_site: { type: String, maxlength: 64 },
    },
    // PNG base64 is only returned by the owner-scoped heatmap endpoint.
    gradcamBase64: { type: String, select: false },
    modelVersion: String,
    inferenceTimeMs: Number,
  },
  { timestamps: true }
);

predictionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Prediction", predictionSchema);
