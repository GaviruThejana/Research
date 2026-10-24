require("dotenv").config();
const mongoose = require("mongoose");
const app = require("./app");
const { connectMongo } = require("./config/db");
const { FASTAPI_URL } = require("./services/aiClient");

const PORT = process.env.PORT || 5000;
const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000]; // then every 30 s
let server;

/**
 * Startup order matters for the apps:
 *  1. Listen right away, so clients never see "can't reach the server" while
 *     MongoDB connects (that takes seconds with the DNS-over-HTTPS fallback).
 *     Until it's connected, /api requests get a JSON 503 "starting up"
 *     (see requireDatabase in app.js).
 *  2. Connect to MongoDB in the background and keep retrying on failure,
 *     instead of exiting: under `node --watch` an exit leaves the API dead
 *     until a file changes.
 * Only real configuration mistakes (missing JWT_SECRET / MONGODB_URI) stop it.
 */
function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be set (see .env.example)");
  }
  if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes("<db_password>")) {
    throw new Error("MONGODB_URI must be set to your real connection string (see .env.example)");
  }

  // Listen on all interfaces so phones/emulators on the LAN can reach the API.
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Node API listening on http://localhost:${PORT} (and your LAN IP, for phones)`);
    checkAiService();
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" || err.code === "EACCES") {
      console.error(`Port ${PORT} is unavailable (${err.code}). Is another copy of the API already running? Otherwise set PORT in .env.`);
    } else {
      console.error("HTTP server error:", err);
    }
    process.exit(1);
  });

  // Log (rather than crash on) connection drops after startup; the driver reconnects.
  mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected; requests will get 503 until it reconnects"));
  mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected"));

  connectWithRetry();
}

async function connectWithRetry(attempt = 0) {
  try {
    await connectMongo();
    console.log(`Connected to MongoDB (database: ${mongoose.connection.name}). API ready.`);
  } catch (err) {
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    console.error(`MongoDB connection failed (attempt ${attempt + 1}): ${err.message}`);
    console.error(`Retrying in ${delay / 1000} s; the API stays up and answers 503 meanwhile.`);
    setTimeout(() => connectWithRetry(attempt + 1), delay).unref();
  }
}

/** Warns at startup (without failing) if the FastAPI classifier isn't reachable. */
async function checkAiService() {
  try {
    const res = await fetch(`${FASTAPI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    const body = await res.json().catch(() => ({}));
    console.log(`AI service at ${FASTAPI_URL}: ${body.status || res.status}`);
  } catch (_err) {
    console.warn(`AI service at ${FASTAPI_URL} is not reachable yet; predictions will return 503 until it starts.`);
  }
}

/** Stops accepting requests, lets in-flight ones finish, then closes MongoDB. */
function shutdown(signal, exitCode = 0) {
  console.log(`${signal} received, shutting down…`);
  const forceExit = setTimeout(() => process.exit(exitCode || 1), 10000).unref();
  (server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve())
    .then(() => mongoose.disconnect())
    .finally(() => {
      clearTimeout(forceExit);
      process.exit(exitCode);
    });
}

// A rejected promise nobody awaited: log it; the request already got a response
// via asyncHandler/errorHandler, so the server can keep running.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

// A synchronous throw outside Express: process state is unknown, so log and
// exit cleanly (a process manager / Docker restart policy brings it back up).
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  shutdown("uncaughtException", 1);
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  start();
} catch (err) {
  console.error("Failed to start server:", err.message);
  process.exit(1);
}
