const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { registerPatient, registerDoctor, login, me, updateMe } = require("../controllers/authController");

const router = express.Router();

// Slows down password guessing and mass sign-ups (per IP). AUTH_RATE_LIMIT
// can be raised for local testing; keep the default (20) in production.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
});

router.post("/register/patient", authLimiter, asyncHandler(registerPatient));
router.post("/register", authLimiter, asyncHandler(registerPatient));
router.post("/register/doctor", authLimiter, asyncHandler(registerDoctor));
router.post("/login", authLimiter, asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/me", requireAuth, asyncHandler(updateMe));

module.exports = router;
