const mongoose = require("mongoose");
const { User, Patient, Doctor, Consultation } = require("../models");
const { parseMedicalHistory } = require("../models/medicalHistorySchema");
const { HttpError } = require("../middleware/errorHandler");
const { saveImage, readSavedImage, publicBaseUrl } = require("../middleware/upload");
const { findOwnPrediction } = require("./predictionController");
const { generateConsultationPdf } = require("../services/pdfReport");
const { sendConsultationEmail } = require("../services/mailer");
const { getRiskLevel } = require("../services/riskLevel");

const MAX_CONSULTATIONS_PER_HOUR = 5;

/**
 * Finds the selected doctor by id or email. Only approved doctors qualify,
 * so the endpoint can't be used to email arbitrary addresses.
 */
async function findApprovedDoctor({ doctorId, doctorEmail }) {
  let filter;
  if (doctorId) {
    if (!mongoose.isValidObjectId(doctorId)) throw new HttpError(400, "Invalid doctorId");
    filter = { _id: doctorId };
  } else if (doctorEmail) {
    filter = { email: String(doctorEmail).toLowerCase().trim() };
  } else {
    throw new HttpError(400, "doctorEmail (or doctorId) is required");
  }

  const doctor = await Doctor.findOne({ ...filter, isApproved: true });
  if (!doctor) throw new HttpError(404, "Doctor not found or not approved");
  return doctor;
}

/**
 * POST /api/consultations   (multipart/form-data or JSON)
 * Fields:
 *   doctorEmail     selected doctor's email (or doctorId)
 *   predictionId    id from POST /api/predictions (preferred): the server uses
 *                   the stored image and AI result, so they can't be altered
 *   -- or, without predictionId --
 *   image           JPEG/PNG file
 *   aiPrediction    e.g. "Melanoma"
 *   aiConfidence?   0..1
 *   medicalHistory? JSON string, see models/medicalHistorySchema.js
 *   patientNote?    free text
 *
 * Generates the PDF report and emails it to the selected approved doctor,
 * CCing the logged-in patient. Patient name/email/country come from the
 * account, never from the request, so a client can't impersonate someone or
 * CC arbitrary addresses.
 */
async function createConsultation(req, res) {
  const { patientNote, predictionId } = req.body || {};
  const submittedHistory = parseMedicalHistory(req.body?.medicalHistory);

  // The AI result + image: from a stored prediction, or (legacy) from the request.
  let aiPrediction;
  let aiConfidence;
  let image; // { buffer, mimetype }
  let imageUrl;
  let patientDetails;
  if (predictionId) {
    const prediction = await findOwnPrediction(predictionId, req.user.id);
    aiPrediction = prediction.displayName;
    aiConfidence = prediction.confidence;
    patientDetails = prediction.patientDetails?.toObject?.() || prediction.patientDetails || {};
    image = await readSavedImage(prediction.imageFile);
    imageUrl = prediction.imageUrl;
  } else {
    aiPrediction = req.body?.aiPrediction;
    aiConfidence = req.body?.aiConfidence === undefined ? undefined : Number(req.body.aiConfidence);
    if (!req.file) throw new HttpError(400, "predictionId (or an image) is required");
    if (!aiPrediction) throw new HttpError(400, "aiPrediction is required");
    if (aiConfidence !== undefined && !(aiConfidence >= 0 && aiConfidence <= 1)) {
      throw new HttpError(400, "aiConfidence must be between 0 and 1");
    }
    image = req.file;
  }

  const doctor = await findApprovedDoctor(req.body || {});

  // Simple abuse guard so doctors' inboxes can't be flooded.
  const recentCount = await Consultation.countDocuments({
    patient: req.user.id,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recentCount >= MAX_CONSULTATIONS_PER_HOUR) {
    throw new HttpError(429, "Too many consultation requests. Please try again in an hour.");
  }

  // Patients' history edits are saved to their profile so the form is pre-filled next time.
  let account = await User.findById(req.user.id);
  if (account.role === "patient" && submittedHistory) {
    const update = Object.fromEntries(Object.entries(submittedHistory).map(([k, v]) => [`medicalHistory.${k}`, v]));
    account = await Patient.findByIdAndUpdate(req.user.id, update, { new: true, runValidators: true });
  }
  const medicalHistory = account.medicalHistory?.toObject?.() || submittedHistory || {};

  const patient = { name: account.name, email: account.email, country: account.country };
  const riskLevel = getRiskLevel(aiPrediction);
  if (!imageUrl) imageUrl = publicBaseUrl(req) + (await saveImage(image));

  const pdfBuffer = await generateConsultationPdf({
    patient,
    doctor: { name: doctor.name, specialization: doctor.specialization, country: doctor.country },
    imageBuffer: image.buffer,
    aiPrediction,
    aiConfidence,
    patientDetails,
    riskLevel,
    medicalHistory,
    patientNote,
    date: new Date(),
  });

  // Record the attempt either way, so failed sends are visible and retryable.
  let emailResult;
  let emailError;
  try {
    emailResult = await sendConsultationEmail({ doctor, patient, aiPrediction, riskLevel, patientNote, pdfBuffer });
  } catch (err) {
    console.error("Consultation email failed:", err);
    emailError = err.message;
  }

  const consultation = await Consultation.create({
    patient: req.user.id,
    doctor: doctor._id,
    prediction: predictionId || undefined,
    imageUrl,
    aiPrediction,
    aiConfidence,
    riskLevel,
    medicalHistory,
    patientNote,
    emailStatus: emailError ? "failed" : "sent",
    emailError,
    messageId: emailResult?.messageId,
  });

  if (emailError) {
    throw new HttpError(502, "The report was created but the email could not be sent. Please try again later.");
  }

  console.log(`[consultation] user=${req.user.id} -> ${doctor.email} (${aiPrediction}, ${riskLevel}) email=${consultation.emailStatus} id=${consultation._id}`);
  res.status(201).json({
    message: `Report sent to ${doctor.name}. A copy was sent to ${patient.email}.`,
    data: { id: consultation._id, doctorName: doctor.name, riskLevel, sentAt: consultation.createdAt },
  });
}

module.exports = { createConsultation };
