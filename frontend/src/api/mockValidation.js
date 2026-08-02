/**
 * Mock OOD (Out-of-Distribution) validation API
 * Simulates image quality validation before analysis
 */

export async function mockValidateImage(file) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Mock validation logic: files < 5KB flagged as blurry
  if (file.size < 5 * 1024) {
    return {
      valid: false,
      error: "ood_blurry",
      message: "Image appears out of focus"
    };
  }

  // Randomly simulate other OOD errors for demo purposes (5% chance each)
  const random = Math.random();
  if (random < 0.05) {
    return {
      valid: false,
      error: "ood_object",
      message: "Non-skin image detected"
    };
  }
  if (random < 0.10) {
    return {
      valid: false,
      error: "ood_low_contrast",
      message: "Insufficient image quality"
    };
  }

  return {
    valid: true,
    error: null,
    message: null
  };
}
