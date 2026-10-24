import { api } from "./client";

/**
 * All approved doctors (the server never returns unapproved ones).
 * @returns {Promise<Array<{_id, name, email, specialization, country, locationCategory}>>}
 */
export async function fetchApprovedDoctors() {
  const { data } = await api.get("/api/doctors");
  return data;
}

/**
 * Approved doctors practising in `country` (exact match, case-insensitive).
 * @returns {Promise<Array<{_id, name, email, specialization, country}>>}
 */
export async function fetchDoctorsByCountry(country) {
  const { data } = await api.get(`/api/doctors/by-country/${encodeURIComponent(country)}`);
  return data;
}
