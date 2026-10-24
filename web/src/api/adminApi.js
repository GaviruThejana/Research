import { api } from "./client";

// Admin portal calls (moved here from the former frontend/ app). The JWT
// is attached by the shared client; the server checks the role.

/** Doctor registrations awaiting (or past) admin approval. Admin only. */
export async function fetchDoctorRegistrations(status = "pending") {
  const { data } = await api.get(`/api/admin/doctors?status=${encodeURIComponent(status)}`);
  return data;
}

/** Sets isApproved: true so the doctor can log in and appears in the directory. Admin only. */
export async function approveDoctor(id) {
  const { data } = await api.patch(`/api/admin/doctors/${encodeURIComponent(id)}/approve`);
  return data;
}

/** Flagged predictions with the given status (default: pending). Admins + expert doctors. */
export async function fetchFlaggedPredictions(status = "pending") {
  const { data } = await api.get(`/api/feedback?status=${encodeURIComponent(status)}`);
  return data;
}

/**
 * Approves or rejects a flagged prediction. Admins + expert doctors.
 * @param {string} id
 * @param {"approved" | "rejected"} status
 */
export async function updateFlaggedPredictionStatus(id, status) {
  const { data } = await api.put(`/api/feedback/${encodeURIComponent(id)}/status`, { status });
  return data;
}
