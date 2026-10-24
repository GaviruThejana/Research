const bcrypt = require("bcryptjs");
const { User, Patient, Doctor } = require("../models");
const { parseMedicalHistory } = require("../models/medicalHistorySchema");
const { signToken } = require("../middleware/auth");
const { HttpError } = require("../middleware/errorHandler");

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

function assertPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

/** Shape returned to clients after register/login. */
function authResponse(user) {
  return {
    token: signToken(user),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      country: user.country,
      isApproved: user.isApproved,
      isDoctor: user.isDoctor,
      // Used by the admin portal (expert reviewers) and to pre-fill doctor reports.
      isExpert: user.isExpert === true,
      medicalHistory: user.medicalHistory,
    },
  };
}

/**
 * POST /api/auth/register/patient (and /register alias)
 * Body: { name, email, password, country, medicalHistory? }
 */
async function registerPatient(req, res) {
  const { name, password, country } = req.body || {};
  const email = req.body?.email ?? req.body?.emailAddress;
  if (!name || !email || !password || !country) {
    throw new HttpError(400, "name, email, password, and country are required");
  }
  assertPassword(password);

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    throw new HttpError(409, "An account with this email address already exists");
  }

  const patient = await Patient.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    country: String(country).trim(),
    medicalHistory: parseMedicalHistory(req.body?.medicalHistory),
  });

  res.status(201).json(authResponse(patient));
}

/**
 * POST /api/auth/register/doctor
 * Body: { name, email, password, specialization, country, licenseNumber }
 * Doctors start unapproved; DO NOT return a JWT token.
 */
async function registerDoctor(req, res) {
  const { name, email, password, specialization, country, licenseNumber } = req.body || {};
  if (!name || !email || !password || !specialization || !country || !licenseNumber) {
    throw new HttpError(400, "name, email, password, specialization, country, and licenseNumber are required");
  }
  assertPassword(password);

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) {
    throw new HttpError(409, "An account with this email address already exists");
  }

  const doctor = await Doctor.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    password,
    specialization: String(specialization).trim(),
    country: String(country).trim(),
    licenseNumber: String(licenseNumber).trim(),
    isApproved: false,
    isExpert: false,
  });

  res.status(201).json({
    success: true,
    message: "Registration successful. Please wait for Admin approval.",
    doctor: {
      id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization,
      country: doctor.country,
      isApproved: doctor.isApproved,
    },
  });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new HttpError(400, "email and password are required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password +passwordHash");
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, "Incorrect email or password");
  }

  // Doctors must be approved by an administrator before logging in
  if (user.role === "doctor" && !user.isApproved) {
    throw new HttpError(403, "Your account is pending admin approval.");
  }

  res.json(authResponse(user));
}

/** GET /api/auth/me — refreshes the client's copy of the user (e.g. after approval). */
async function me(req, res) {
  const user = await User.findById(req.user.id);
  res.json({ user: user.toJSON() });
}

/**
 * PATCH /api/auth/me
 * Body: { country?, medicalHistory? }  (patients only)
 * Lets older accounts without a country set one, and keeps the medical
 * history that is pre-filled into doctor reports up to date.
 */
async function updateMe(req, res) {
  if (req.user.role !== "patient") {
    throw new HttpError(403, "Only patients can update these profile fields");
  }

  const update = {};
  if (req.body?.country !== undefined) update.country = req.body.country;
  const medicalHistory = parseMedicalHistory(req.body?.medicalHistory);
  if (medicalHistory) {
    for (const [key, value] of Object.entries(medicalHistory)) update[`medicalHistory.${key}`] = value;
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, "Nothing to update");
  }

  const patient = await Patient.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
  res.json({ user: patient.toJSON() });
}

module.exports = { registerPatient, registerDoctor, login, me, updateMe };
