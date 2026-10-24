/**
 * DEV ONLY: inserts sample doctors and a sample patient for the
 * country-based doctor directory. Safe to re-run (upserts by email).
 *
 *   npm run seed              # insert / update the sample accounts
 *   npm run seed -- --remove  # delete them again
 *
 * Every account uses SEED_PASSWORD from .env, or the default below.
 * Emails use the reserved example.com domain, so nothing is ever delivered
 * to a real person even if SMTP is configured.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User, Patient, Doctor } = require("../src/models");
const { connectMongo } = require("../src/config/db");

const SEED_PASSWORD = process.env.SEED_PASSWORD || "SkinAI-demo-2026";

// Seeded doctors are pre-approved so they show up in the directory immediately.
const DOCTORS = [
  // Sri Lanka
  { name: "Dr. Nimal Perera", email: "nimal.perera@example.com", specialization: "Consultant Dermatologist", country: "Sri Lanka", licenseNumber: "SLMC-20481" },
  { name: "Dr. Shalini Fernando", email: "shalini.fernando@example.com", specialization: "Dermatologist & Dermatosurgeon", country: "Sri Lanka", licenseNumber: "SLMC-18733" },
  { name: "Dr. Kasun Jayasinghe", email: "kasun.jayasinghe@example.com", specialization: "Paediatric Dermatologist", country: "Sri Lanka", licenseNumber: "SLMC-22915" },
  // USA
  { name: "Dr. Emily Carter", email: "emily.carter@example.com", specialization: "Board-Certified Dermatologist (Skin Cancer)", country: "USA", licenseNumber: "NY-MD-301274" },
  { name: "Dr. Michael Brooks", email: "michael.brooks@example.com", specialization: "Mohs Surgeon & Dermatopathologist", country: "USA", licenseNumber: "CA-A-145522" },
];

const PATIENT = {
  name: "Kavindi Silva",
  email: "patient.demo@example.com",
  country: "Sri Lanka",
  medicalHistory: {
    previousSkinConditions: "Eczema in childhood",
    familyHistoryOfSkinCancer: "yes",
    allergies: "Penicillin",
    currentMedications: "None",
    additionalNotes: "Works outdoors; frequent sun exposure.",
  },
};

const ALL_EMAILS = [...DOCTORS.map((d) => d.email), PATIENT.email];

async function seed() {
  // findOneAndUpdate skips the User pre-save hook, so hash here.
  const password = await bcrypt.hash(SEED_PASSWORD, 12);
  const clearLegacy = { $unset: { passwordHash: 1 } };
  const upsert = { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true };

  for (const doctor of DOCTORS) {
    await Doctor.findOneAndUpdate(
      { email: doctor.email },
      { $set: { ...doctor, password, isApproved: true, approvedAt: new Date() }, ...clearLegacy },
      upsert
    );
    console.log(`  doctor   ${doctor.country.padEnd(9)} ${doctor.name}`);
  }

  await Patient.findOneAndUpdate({ email: PATIENT.email }, { $set: { ...PATIENT, password }, ...clearLegacy }, upsert);
  console.log(`  patient  ${PATIENT.country.padEnd(9)} ${PATIENT.name} <${PATIENT.email}>`);
  console.log(`\nSeeded ${DOCTORS.length} doctors and 1 patient. Password: see SEED_PASSWORD in scripts/seedTeledermatology.js`);
}

async function remove() {
  const { deletedCount } = await User.deleteMany({ email: { $in: ALL_EMAILS } });
  console.log(`Removed ${deletedCount} seeded accounts.`);
}

async function main() {
  await connectMongo();
  console.log(`Database: ${mongoose.connection.name}`);
  if (process.argv.includes("--remove")) await remove();
  else await seed();
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
