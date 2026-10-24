const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const { HttpError } = require("./errorHandler");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/**
 * Accepts an optional multipart `image` field, kept in memory until the
 * controller decides to persist it.
 * @param {string[]} allowedTypes MIME types to accept (subset of EXTENSIONS)
 */
function createImageUpload(allowedTypes = Object.keys(EXTENSIONS)) {
  const label = allowedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ");
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) return cb(null, true);
      return cb(new HttpError(400, `Image must be one of: ${label}`));
    },
  }).single("image");
}

/** Flagged predictions: any supported image type. */
const imageUpload = createImageUpload();

/** Consultation PDFs: pdfkit can only embed JPEG and PNG. */
const pdfImageUpload = createImageUpload(["image/jpeg", "image/png"]);

/**
 * Writes the image to uploads/ named by its SHA-256 hash, so re-uploading the
 * same photo yields the same URL (which the duplicate-report index relies on).
 * @returns {Promise<string>} public path, e.g. "/uploads/<hash>.jpg"
 */
async function saveImage(file) {
  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const filename = `${hash}${EXTENSIONS[file.mimetype]}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);
  return `/uploads/${filename}`;
}

/** Reads a previously saved upload (e.g. a prediction's image) back into memory. */
async function readSavedImage(filename) {
  // Only the bare hash-based names saveImage() produces; never a path.
  if (!/^[a-f0-9]{64}\.(jpg|png|webp)$/.test(filename)) throw new HttpError(500, "Invalid stored image name");
  const buffer = await fs.readFile(path.join(UPLOAD_DIR, filename));
  const mimetype = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { buffer, mimetype };
}

/** Base URL that clients (admin portal, phones) can load uploaded images from. */
function publicBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
}

module.exports = { imageUpload, pdfImageUpload, saveImage, readSavedImage, publicBaseUrl, UPLOAD_DIR };
