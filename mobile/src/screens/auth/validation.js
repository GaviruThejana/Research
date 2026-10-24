const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// Client-side checks for quick feedback; the server validates again.

export function validatePatientForm({ name, emailAddress, password, country }) {
  const errors = {};
  if (country !== undefined && !country) errors.country = "Select your country.";
  if (!name.trim()) errors.name = "Enter your name.";
  if (!EMAIL_PATTERN.test(emailAddress.trim())) errors.emailAddress = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return errors;
}

export function validateDoctorForm({ name, email, password, specialization, country, licenseNumber }) {
  const errors = validatePatientForm({ name, emailAddress: email, password, country });
  if (errors.emailAddress) {
    errors.email = errors.emailAddress;
    delete errors.emailAddress;
  }
  if (!specialization.trim()) errors.specialization = "Enter your specialization.";
  if (!licenseNumber.trim()) errors.licenseNumber = "Enter your medical license number.";
  return errors;
}
