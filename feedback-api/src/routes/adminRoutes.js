const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { listDoctorsForAdmin, approveDoctor } = require("../controllers/doctorController");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/doctors", asyncHandler(listDoctorsForAdmin));
router.patch("/doctors/:id/approve", asyncHandler(approveDoctor));

module.exports = router;
