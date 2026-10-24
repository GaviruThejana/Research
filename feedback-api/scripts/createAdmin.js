/**
 * Creates an admin account, or promotes/resets an existing one. Admins can't
 * self-register through the API, so the first one is created from the shell:
 *
 *   npm run create-admin -- admin@example.com "S3cure-password" "Admin Name"
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User } = require("../src/models");
const { connectMongo } = require("../src/config/db");

async function main() {
  const [email, password, name = "Administrator"] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    throw new Error('Usage: npm run create-admin -- <email> <password (8+ chars)> ["Name"]');
  }

  await connectMongo();
  // overwriteDiscriminatorKey: lets an existing patient/doctor account be promoted to admin.
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    // findOneAndUpdate skips the pre-save hook, so hash here; clear the legacy field
    // so this password (not an older one) is the one matchPassword() checks.
    { $set: { name, role: "admin", password: await bcrypt.hash(password, 12) }, $unset: { passwordHash: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, overwriteDiscriminatorKey: true }
  );
  console.log(`Admin ready: ${user.email}`);
}

main()
  .catch((err) => {
    console.error("Failed to create admin:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
