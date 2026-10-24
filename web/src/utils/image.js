/**
 * Web equivalent of expo-image-picker's
 *   { allowsEditing: true, aspect: [1, 1], quality: 0.8 }
 * Takes the File from <input type="file">, center-crops it to a square and
 * re-encodes it as JPEG (quality 0.8), so the server always receives a JPEG
 * (it accepts only JPEG/PNG) whatever the phone produced.
 *
 * - Orientation: <img> applies EXIF rotation before we draw it, so portrait
 *   phone photos aren't sideways.
 * - Size: capped at 2048 px so uploads stay well under the server's 8 MB limit.
 */
const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.8;

export class ImageFormatError extends Error {
  constructor() {
    super("This photo format isn't supported. Please choose a JPEG or PNG image.");
    this.name = "ImageFormatError";
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageFormatError());
    };
    img.src = url;
  });
}

/**
 * @param {File} file image chosen by the user
 * @returns {Promise<File>} square JPEG ready for predictLesion()
 */
export async function prepareImage(file) {
  if (!file || !file.type.startsWith("image/")) throw new ImageFormatError();

  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const outSide = Math.min(side, MAX_SIDE);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = outSide;
  canvas.height = outSide;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new ImageFormatError();
  return new File([blob], "lesion.jpg", { type: "image/jpeg" });
}
