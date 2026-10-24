const mongoose = require("mongoose");
const { HttpError } = require("../middleware/errorHandler");

const text = { type: String, trim: true, maxlength: 500 };

/**
 * Patient-reported medical history. Embedded in Patient (kept up to date by
 * the app) and snapshotted into each Consultation (what the doctor was sent).
 */
const medicalHistorySchema = new mongoose.Schema(
  {
    previousSkinConditions: text,
    familyHistoryOfSkinCancer: { type: String, enum: ["yes", "no", "unknown"], default: "unknown" },
    allergies: text,
    currentMedications: text,
    additionalNotes: { ...text, maxlength: 1000 },
  },
  { _id: false }
);

const MEDICAL_HISTORY_FIELDS = Object.keys(medicalHistorySchema.paths);

/**
 * Picks the known medical-history fields from untrusted input (a JSON string
 * from a multipart form, or an object). Unknown keys are dropped.
 * @returns {object|undefined}
 */
function parseMedicalHistory(input) {
  if (input === undefined || input === null || input === "") return undefined;
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input);
    } catch (_err) {
      throw new HttpError(400, "medicalHistory must be valid JSON");
    }
  }
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    MEDICAL_HISTORY_FIELDS.filter((key) => value[key] !== undefined).map((key) => [key, value[key]])
  );
}

module.exports = { medicalHistorySchema, parseMedicalHistory };
