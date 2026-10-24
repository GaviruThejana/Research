const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { listApprovedDoctors, listDoctorsByCountry } = require("../controllers/doctorController");

const router = express.Router();

// Logged-in users only, so doctors' emails aren't publicly scrapeable.
router.get("/", requireAuth, asyncHandler(listApprovedDoctors));
// Doctors practising in one country, e.g. the logged-in patient's.
router.get("/by-country/:country", requireAuth, asyncHandler(listDoctorsByCountry));

module.exports = router;
