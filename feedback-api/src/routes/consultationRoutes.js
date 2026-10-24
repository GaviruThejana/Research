const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { pdfImageUpload } = require("../middleware/upload");
const { createConsultation } = require("../controllers/consultationController");

const router = express.Router();

// "Send to Dermatologist": PDF report emailed to the doctor, CC the patient.
router.post("/", requireAuth, pdfImageUpload, asyncHandler(createConsultation));

module.exports = router;
