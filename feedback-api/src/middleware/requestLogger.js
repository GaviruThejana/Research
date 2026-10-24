const crypto = require("crypto");

/**
 * Gives every request a short id (echoed in the X-Request-Id header and in
 * error responses) and logs one line when it finishes:
 *
 *   [2026-10-12T10:15:02.123Z] a1b2c3d4 POST /api/predictions 201 812ms user=66f...
 *
 * Quote the id from an app error message to find the matching server log line.
 */
function requestLogger(req, res, next) {
  req.id = crypto.randomBytes(4).toString("hex");
  res.setHeader("X-Request-Id", req.id);
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    if (req.originalUrl === "/health") return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const user = req.user ? ` user=${req.user.id}` : "";
    const line = `[${new Date().toISOString()}] ${req.id} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms${user}`;
    (res.statusCode >= 500 ? console.error : console.log)(line);
  });

  next();
}

module.exports = { requestLogger };
