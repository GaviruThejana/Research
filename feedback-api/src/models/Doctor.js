const mongoose = require("mongoose");
const User = require("./User");
const { isLocalCountry } = require("./User");

/**
 * Doctor (role: 'doctor'). Starts unapproved; an admin verifies the license
 * before the doctor appears in the directory or gains doctor privileges.
 */
const doctorSchema = new mongoose.Schema({
  specialization: { type: String, required: [true, "specialization is required"], trim: true, maxlength: 120 },
  country: { type: String, required: [true, "country is required"], trim: true, maxlength: 80 },
  licenseNumber: { type: String, required: [true, "licenseNumber is required"], trim: true, maxlength: 60 },
  isApproved: { type: Boolean, default: false },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  // Approved doctors who may also approve/reject flagged predictions.
  isExpert: { type: Boolean, default: false },
});

// "local" (Sri Lanka) or "international", used to group the directory.
doctorSchema.virtual("locationCategory").get(function locationCategory() {
  return isLocalCountry(this.country) ? "local" : "international";
});

module.exports = User.discriminators?.Doctor || User.discriminator("Doctor", doctorSchema, "doctor");
