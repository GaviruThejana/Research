const express = require("express");
const { requireAuth, requireExpert } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { imageUpload } = require("../middleware/upload");
const {
  reportPrediction,
  listFlaggedPredictions,
  updateValidationStatus,
} = require("../controllers/feedbackController");

const router = express.Router();

router.use(requireAuth);

// Mobile app: any logged-in user can flag a result.
router.post("/report", imageUpload, asyncHandler(reportPrediction));

// Admin portal: expert doctors only.
router.get("/", requireExpert, asyncHandler(listFlaggedPredictions));
router.put("/:id/status", requireExpert, asyncHandler(updateValidationStatus));

module.exports = router;
