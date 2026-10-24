const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { pdfImageUpload } = require("../middleware/upload");
const { createPrediction, listMyPredictions, getPredictionHeatmap } = require("../controllers/predictionController");

const router = express.Router();

// All AI predictions go through here (JWT-protected), not straight to FastAPI.
// JPEG/PNG only, so the stored image can later be embedded in PDF reports.
router.post("/", requireAuth, pdfImageUpload, asyncHandler(createPrediction));
router.get("/:predictionId/heatmap", requireAuth, asyncHandler(getPredictionHeatmap));
router.get("/", requireAuth, asyncHandler(listMyPredictions));

module.exports = router;
