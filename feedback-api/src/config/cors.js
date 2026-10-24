/**
 * CORS policy.
 *
 * - Native mobile apps (Expo Go, emulators, devices) send no Origin header, so
 *   CORS never blocks them; they only need the right IP/port.
 * - Browsers (admin portal, Expo web) must match CORS_ORIGINS exactly.
 * - CORS_ALLOW_LAN=true (development only) also allows any http origin on a
 *   private network (localhost, 127.x, 10.x, 172.16-31.x, 192.168.x), handy
 *   when testing from another PC/phone browser on the same Wi-Fi.
 */
const PRIVATE_ORIGIN =
  /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

function corsOptions() {
  const allowed = new Set(
    (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean)
  );
  const allowLan = process.env.CORS_ALLOW_LAN === "true" && process.env.NODE_ENV !== "production";
  const rejected = new Set();

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin) || (allowLan && PRIVATE_ORIGIN.test(origin))) {
        return callback(null, true);
      }
      // Log each blocked origin once: the usual cause of "Network Error" in a browser.
      if (!rejected.has(origin)) {
        rejected.add(origin);
        console.warn(`[cors] Blocked browser origin ${origin}. Add it to CORS_ORIGINS in feedback-api/.env.`);
      }
      return callback(null, false);
    },
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  };
}

module.exports = { corsOptions };
