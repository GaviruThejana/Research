const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const LOCAL_COUNTRY = "Sri Lanka";

/**
 * Base account schema shared by every role. Stored in the `users` collection.
 *
 * `role` is the discriminator key: Patient (role 'patient') and Doctor
 * (role 'doctor') extend this schema with their own fields — see Patient.js
 * and Doctor.js. Admins are plain User documents with role 'admin'.
 *
 * Keeping one collection means login, JWT auth and permissions work the same
 * for every role, while each role still has its own schema and model.
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "name is required"], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, "email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email must be a valid email address"],
    },
    // Password field stored securely; never returned by queries unless explicitly selected.
    password: { type: String, select: false },
    passwordHash: { type: String, select: false },
  },
  {
    discriminatorKey: "role",
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.passwordHash;
        delete ret.__v;
        delete ret.id; // duplicate of _id added by `virtuals: true`
        return ret;
      },
    },
  }
);

// Pre-save hook: Hash password with bcryptjs before saving if modified
userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Compare entered password with stored hash (supports both password and passwordHash)
userSchema.methods.matchPassword = async function (enteredPassword) {
  const hash = this.password || this.passwordHash;
  if (!hash || !enteredPassword) return false;
  return bcrypt.compare(enteredPassword, hash);
};

// Doctors get doctor privileges only once an admin approves them.
userSchema.virtual("isDoctor").get(function isDoctor() {
  return this.role === "doctor" && this.isApproved === true;
});

// The doctor directory and the admin approval queue filter on these.
// (Defined on the base schema because all roles share one collection.)
userSchema.index({ role: 1, isApproved: 1, country: 1, name: 1 });

function isLocalCountry(country) {
  return String(country || "").trim().toLowerCase() === LOCAL_COUNTRY.toLowerCase();
}

const User = mongoose.model("User", userSchema);

module.exports = User;
module.exports.LOCAL_COUNTRY = LOCAL_COUNTRY;
module.exports.isLocalCountry = isLocalCountry;
