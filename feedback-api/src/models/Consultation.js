const mongoose = require("mongoose");
const { medicalHistorySchema } = require("./medicalHistorySchema");

/**
 * Audit record of a "Send to Dermatologist" request: who sent what to whom,
 * and whether the email was delivered.
 */
const consultationSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    prediction: { type: mongoose.Schema.Types.ObjectId, ref: "Prediction" },
    imageUrl: { type: String, required: true },
    aiPrediction: { type: String, required: true, trim: true, maxlength: 120 },
    aiConfidence: { type: Number, min: 0, max: 1 },
    riskLevel: { type: String, enum: ["High", "Moderate", "Low", "Unknown"] },
    // Snapshot of what was sent, even if the patient later edits their profile.
    medicalHistory: medicalHistorySchema,
    patientNote: { type: String, trim: true, maxlength: 1000 },
    emailStatus: { type: String, enum: ["sent", "failed"], required: true },
    emailError: String,
    messageId: String,
  },
  { timestamps: true }
);

// Used by the per-patient rate limit.
consultationSchema.index({ patient: 1, createdAt: -1 });

module.exports = mongoose.model("Consultation", consultationSchema);
