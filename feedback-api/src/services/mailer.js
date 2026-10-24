const fs = require("fs/promises");
const path = require("path");
const nodemailer = require("nodemailer");

const OUTBOX_DIR = path.join(__dirname, "..", "..", "outbox");

let transporterPromise;

/**
 * SMTP transport from env vars. Without SMTP_HOST (local development) emails
 * are written as .eml files to feedback-api/outbox/ instead of being sent,
 * so the flow can be tested without real credentials.
 */
function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      process.env.SMTP_HOST
        ? nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true", // true for port 465
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
        : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" })
    );
  }
  return transporterPromise;
}

/**
 * Sends the consultation PDF to the doctor, CCing the patient.
 * @returns {Promise<{messageId: string, savedTo?: string}>}
 */
async function sendConsultationEmail({ doctor, patient, aiPrediction, riskLevel, patientNote, pdfBuffer }) {
  const transporter = await getTransporter();
  const safeName = (s) => String(s).replace(/[\r\n]+/g, " ").trim();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || "SkinAI <no-reply@skinai.local>",
    to: { name: safeName(doctor.name), address: doctor.email },
    cc: { name: safeName(patient.name), address: patient.email },
    // Replies go to the patient, not the no-reply sender.
    replyTo: { name: safeName(patient.name), address: patient.email },
    subject:
      `Skin lesion consultation request from ${safeName(patient.name)}` +
      (riskLevel && riskLevel !== "Unknown" ? ` (AI: ${riskLevel} risk)` : ""),
    text: [
      `Dear ${safeName(doctor.name)},`,
      "",
      `${safeName(patient.name)} (${patient.email}${patient.country ? `, ${patient.country}` : ""}) ` +
        `has requested your opinion on a skin lesion that SkinAI classified as "${aiPrediction}"` +
        (riskLevel && riskLevel !== "Unknown" ? ` (${riskLevel} risk).` : "."),
      patientNote ? `\nPatient note:\n${patientNote}\n` : "",
      "The attached PDF includes the patient's details, the image and their medical history. " +
        "Reply to this email to contact the patient directly.",
      "",
      "This is an AI screening result, not a diagnosis.",
      "- SkinAI",
    ].join("\n"),
    attachments: [
      { filename: "SkinAI-consultation-report.pdf", content: pdfBuffer, contentType: "application/pdf" },
    ],
  });

  // Dev mode: persist the rendered message so it can be opened in a mail client.
  if (info.message) {
    await fs.mkdir(OUTBOX_DIR, { recursive: true });
    const savedTo = path.join(OUTBOX_DIR, `${Date.now()}-consultation.eml`);
    await fs.writeFile(savedTo, info.message);
    console.log(`SMTP not configured; email saved to ${savedTo}`);
    return { messageId: info.messageId, savedTo };
  }

  return { messageId: info.messageId };
}

module.exports = { sendConsultationEmail };
