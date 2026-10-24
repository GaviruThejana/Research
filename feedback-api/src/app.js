const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/authRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const adminRoutes = require("./routes/adminRoutes");
const consultationRoutes = require("./routes/consultationRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const { corsOptions } = require("./config/cors");
const { requestLogger } = require("./middleware/requestLogger");
const { UPLOAD_DIR } = require("./middleware/upload");
const { notFound, errorHandler } = require("./middleware/errorHandler");

/*
 * Middleware pipeline (order matters):
 *   1. requestLogger   request id + one log line per request
 *   2. cors            browser origins (native apps are unaffected)
 *   3. express.json    JSON bodies; multipart is parsed per-route by multer
 *   4. requireDatabase /api/* answers 503 "starting up" until MongoDB is connected
 *   5. routes          protected routes run requireAuth (JWT) first
 *   6. notFound        unknown routes -> JSON 404
 *   7. errorHandler    every thrown/rejected error -> clean JSON response
 */
const app = express();

// Behind a reverse proxy, trust X-Forwarded-* so rate limits see the client IP.
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

app.use(requestLogger);
app.use(cors(corsOptions()));
// Allow the requested large JSON payload ceiling. Image prediction currently
// uses multipart/form-data and is separately capped by Multer at 8 MiB.
app.use(express.json({ limit: "50mb" }));

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

// Liveness + readiness: the process is up; `database` says whether requests can be served.
app.get("/health", (_req, res) =>
  res.json({ status: "ok", database: DB_STATES[mongoose.connection.readyState] || "unknown" })
);

// Until MongoDB is connected (startup, or a dropped connection), answer API
// calls with a clear, retryable 503 instead of hanging or failing obscurely.
app.use("/api", (_req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.set("Retry-After", "5");
  return res.status(503).json({
    error: "The server is starting up or reconnecting to the database. Please try again in a few seconds.",
  });
});
app.use("/uploads", express.static(UPLOAD_DIR, { fallthrough: false, maxAge: "7d" }));

app.use("/api/auth", authRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/feedback", feedbackRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
