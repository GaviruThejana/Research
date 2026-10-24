const mongoose = require("mongoose");
const { Doctor } = require("../models");
const { HttpError } = require("../middleware/errorHandler");

// Public directory fields only (no license number, no audit fields).
const DIRECTORY_FIELDS = "name email specialization country role isApproved";
const ADMIN_FIELDS = "name email specialization country licenseNumber role isApproved approvedAt createdAt";

// Case-insensitive *exact* string comparison ("usa" matches "USA", "US" does not).
const CASE_INSENSITIVE = { locale: "en", strength: 2 };

/**
 * GET /api/doctors
 * All approved doctors for the in-app directory, sorted by name.
 * The mobile app groups them into local / international via `locationCategory`.
 */
async function listApprovedDoctors(_req, res) {
  const doctors = await Doctor.find({ isApproved: true }).select(DIRECTORY_FIELDS).sort({ name: 1 });
  res.json({ data: doctors.map(toDirectoryEntry) });
}

/**
 * GET /api/doctors/by-country/:country
 * Approved doctors whose country exactly matches :country (ignoring case and
 * surrounding spaces), e.g. /api/doctors/by-country/Sri%20Lanka
 */
async function listDoctorsByCountry(req, res) {
  const country = String(req.params.country || "").trim();
  if (!country || country.length > 80) {
    throw new HttpError(400, "A valid country is required");
  }

  const doctors = await Doctor.find({ isApproved: true, country })
    .collation(CASE_INSENSITIVE)
    .select(DIRECTORY_FIELDS)
    .sort({ name: 1 });

  res.json({ country, data: doctors.map(toDirectoryEntry) });
}

/**
 * GET /api/admin/doctors?status=pending|approved
 * Doctor registrations for the admin dashboard, oldest first.
 */
async function listDoctorsForAdmin(req, res) {
  const status = req.query.status || "pending";
  if (!["pending", "approved"].includes(status)) {
    throw new HttpError(400, "status must be 'pending' or 'approved'");
  }

  const doctors = await Doctor.find({ isApproved: status === "approved" })
    .select(ADMIN_FIELDS)
    .sort({ createdAt: 1 });

  res.json({ data: doctors.map((d) => d.toJSON()) });
}

/**
 * PATCH /api/admin/doctors/:id/approve
 * Sets isApproved: true. Only unapproved doctor accounts can be approved.
 */
async function approveDoctor(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(400, "Invalid doctor id");
  }

  const doctor = await Doctor.findOneAndUpdate(
    { _id: id, isApproved: false },
    { isApproved: true, approvedAt: new Date(), approvedBy: req.user.id },
    { new: true }
  ).select(ADMIN_FIELDS);

  if (!doctor) {
    const exists = await Doctor.exists({ _id: id });
    throw exists
      ? new HttpError(409, "Doctor is already approved")
      : new HttpError(404, "Doctor not found");
  }

  res.json({ message: "Doctor approved", data: doctor.toJSON() });
}

function toDirectoryEntry(doctor) {
  const { _id, name, email, specialization, country, locationCategory } = doctor.toJSON();
  return { _id, name, email, specialization, country, locationCategory };
}

module.exports = { listApprovedDoctors, listDoctorsByCountry, listDoctorsForAdmin, approveDoctor };
