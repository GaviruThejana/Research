const mongoose = require("mongoose");
const multer = require("multer");

/** Error carrying an HTTP status code, thrown by controllers/middleware. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wraps an async route handler so rejected promises reach `next()`. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, _res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Global error handler: the last middleware in app.js. Every error thrown in
 * a route (sync, or async via asyncHandler) ends up here and is turned into a
 * clean JSON response `{ error, requestId? }` instead of crashing the server
 * or leaking a stack trace.
 */
function errorHandler(err, req, res, next) {
  // Headers already sent (e.g. a streamed response failed midway): let Express close it.
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    return res.status(400).json({ error: message });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }

  // Duplicate key from a unique index.
  if (err.code === 11000) {
    const message = err.keyPattern?.email
      ? "An account with this email already exists"
      : "You have already reported this result";
    return res.status(409).json({ error: message });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 8 MB or smaller" : err.message;
    return res.status(400).json({ error: message });
  }

  // Missing file under /uploads (express.static with fallthrough: false).
  if (err.status === 404 || err.statusCode === 404) {
    return res.status(404).json({ error: "Not found" });
  }

  // Malformed / oversized JSON body from express.json().
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  // Anything else is a bug: log it in full, but only send a generic message.
  console.error(`[error] ${req.id || "-"} ${req.method} ${req.originalUrl}
`, err);
  return res.status(500).json({
    error: "Something went wrong on our side. Please try again.",
    requestId: req.id,
  });
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
