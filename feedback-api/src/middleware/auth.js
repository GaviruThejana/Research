const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { HttpError, asyncHandler } = require("./errorHandler");

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "7d";

/** Signs a JWT that only identifies the user; roles are re-read per request. */
function signToken(user) {
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/**
 * Verifies `Authorization: Bearer <jwt>` and attaches
 * `req.user = { id, name, email, role, isApproved, isDoctor, isExpert, isAdmin }`.
 *
 * The user is loaded from MongoDB on every request so that an admin's
 * approval (or a deleted account) takes effect immediately, without the
 * user having to log in again.
 */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (_err) {
    throw new HttpError(401, "Invalid or expired token. Please log in again.");
  }

  const user = await User.findById(payload.id);
  if (!user) {
    throw new HttpError(401, "Account no longer exists");
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    country: user.country,
    isApproved: user.isApproved === true,
    isDoctor: user.isDoctor,
    isAdmin: user.role === "admin",
    // Admins can always review; doctors need the expert flag as well.
    isExpert: user.role === "admin" || (user.isDoctor && user.isExpert),
  };
  next();
});

/** Restricts a route to reviewers of flagged predictions. */
function requireExpert(req, _res, next) {
  if (!req.user?.isExpert) {
    return next(new HttpError(403, "Expert doctor access required"));
  }
  return next();
}

/** Restricts a route to admins. */
function requireAdmin(req, _res, next) {
  if (!req.user?.isAdmin) {
    return next(new HttpError(403, "Admin access required"));
  }
  return next();
}

module.exports = { signToken, requireAuth, requireExpert, requireAdmin };
