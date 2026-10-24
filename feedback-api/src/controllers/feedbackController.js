const FlaggedPrediction = require("../models/FlaggedPrediction");
const { VALIDATION_STATUSES } = require("../config/labels");
const { HttpError } = require("../middleware/errorHandler");
const { saveImage, publicBaseUrl } = require("../middleware/upload");
const { findOwnPrediction } = require("./predictionController");

/**
 * POST /api/feedback/report
 * JSON body:      { predictionId, doctorLabel? }   (preferred)
 *            or:   { imageUrl, aiPrediction, doctorLabel? }
 * or multipart:   image (file), aiPrediction, doctorLabel?
 * Any authenticated user may report; only doctors may attach a label.
 */
async function reportPrediction(req, res) {
  const { doctorLabel, predictionId } = req.body || {};
  let { imageUrl, aiPrediction } = req.body || {};

  if (doctorLabel && !req.user.isDoctor) {
    throw new HttpError(403, "Only doctors can provide a ground-truth label");
  }

  // Preferred: reference a stored prediction (image + AI label come from the server).
  if (predictionId) {
    const prediction = await findOwnPrediction(predictionId, req.user.id);
    imageUrl = prediction.imageUrl;
    aiPrediction = prediction.displayName;
  } else if (req.file) {
    imageUrl = publicBaseUrl(req) + (await saveImage(req.file));
  }

  // Mongoose schema validation handles required fields, URL format and enum.
  const report = await FlaggedPrediction.create({
    imageUrl,
    aiPrediction,
    doctorLabel: doctorLabel || undefined,
    reportedBy: req.user.id,
  });

  res.status(201).json({ message: "Report submitted", data: report });
}

/**
 * GET /api/feedback?status=pending
 * Lists reports for the admin portal, oldest first.
 */
async function listFlaggedPredictions(req, res) {
  const status = req.query.status || "pending";
  if (!VALIDATION_STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of: ${VALIDATION_STATUSES.join(", ")}`);
  }

  const reports = await FlaggedPrediction.find({ validationStatus: status })
    .sort({ createdAt: 1 })
    .populate("reportedBy", "name email role isApproved")
    .lean();

  res.json({ data: reports });
}

/**
 * PUT /api/feedback/:id/status
 * Body: { status: 'approved' | 'rejected' }
 * Only pending reports can be reviewed; the conditional update makes this
 * safe against two experts reviewing the same report at once.
 */
async function updateValidationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!["approved", "rejected"].includes(status)) {
    throw new HttpError(400, "status must be 'approved' or 'rejected'");
  }

  const report = await FlaggedPrediction.findById(id);
  if (!report) {
    throw new HttpError(404, "Report not found");
  }
  if (report.validationStatus !== "pending") {
    throw new HttpError(409, `Report has already been ${report.validationStatus}`);
  }
  // An approved record feeds fine-tuning, so it must carry a label.
  if (status === "approved" && !report.doctorLabel) {
    throw new HttpError(422, "Cannot approve a report without a doctor label");
  }

  const updated = await FlaggedPrediction.findOneAndUpdate(
    { _id: id, validationStatus: "pending" },
    {
      validationStatus: status,
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    },
    { new: true, runValidators: true }
  );

  if (!updated) {
    throw new HttpError(409, "Report was reviewed by someone else");
  }

  res.json({ message: `Report ${status}`, data: updated });
}

module.exports = { reportPrediction, listFlaggedPredictions, updateValidationStatus };
