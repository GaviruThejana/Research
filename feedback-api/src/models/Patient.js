const mongoose = require("mongoose");
const User = require("./User");
const { medicalHistorySchema } = require("./medicalHistorySchema");

/**
 * Patient (role: 'patient'). `country` is used to match the patient with
 * doctors practising in the same country.
 */
const patientSchema = new mongoose.Schema({
  country: { type: String, required: [true, "country is required"], trim: true, maxlength: 80 },
  medicalHistory: { type: medicalHistorySchema, default: () => ({}) },
});

module.exports = User.discriminators?.Patient || User.discriminator("Patient", patientSchema, "patient");
