const mongoose = require("mongoose");
const { DISEASE_LABELS, VALIDATION_STATUSES } = require("../config/labels");

/**
 * A prediction that a user flagged as incorrect. Approved records (with a
 * doctorLabel) form the curated dataset used for future fine-tuning.
 */
const flaggedPredictionSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: [true, "imageUrl is required"],
      trim: true,
      validate: {
        validator: (value) => /^https?:\/\/\S+$/i.test(value),
        message: "imageUrl must be an http(s) URL",
      },
    },
    aiPrediction: {
      type: String,
      required: [true, "aiPrediction is required"],
      trim: true,
    },
    // Only doctors may supply this; it is the proposed ground-truth label.
    doctorLabel: {
      type: String,
      enum: { values: DISEASE_LABELS, message: "Unknown label '{VALUE}'" },
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    validationStatus: {
      type: String,
      enum: VALIDATION_STATUSES,
      default: "pending",
    },
    // Audit trail for the expert review step.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// The admin dashboard lists the oldest pending reports first.
flaggedPredictionSchema.index({ validationStatus: 1, createdAt: 1 });

// One report per user per image keeps the review queue free of duplicates.
flaggedPredictionSchema.index({ imageUrl: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model("FlaggedPrediction", flaggedPredictionSchema);
