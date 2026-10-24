import { api } from "./client";

// Public routes (auth: false): no token is sent, and a 401 here means wrong
// credentials, not an expired session.

/** @returns {Promise<{token: string, user: object}>} */
export function login(email, password) {
  return api.post("/api/auth/login", { email, password }, { auth: false });
}

/** Patient sign-up. @returns {Promise<{token: string, user: object}>} */
export function registerPatient({ name, email, emailAddress, password, country }) {
  return api.post(
    "/api/auth/register/patient",
    { name, email: email || emailAddress, password, country },
    { auth: false }
  );
}

/**
 * Doctor sign-up. No token is returned: doctors can log in once an admin
 * approves them. @returns {Promise<{message: string}>}
 */
export function registerDoctor({ name, email, password, specialization, country, licenseNumber }) {
  return api.post(
    "/api/auth/register/doctor",
    { name, email, password, specialization, country, licenseNumber },
    { auth: false }
  );
}

/** @returns {Promise<object>} the current user (token attached automatically) */
export async function fetchMe() {
  const { user } = await api.get("/api/auth/me");
  return user;
}

/**
 * Updates the patient's own profile ({ country?, medicalHistory? }).
 * @returns {Promise<object>} the updated user
 */
export async function updateProfile(changes) {
  const { user } = await api.patch("/api/auth/me", changes);
  return user;
}
