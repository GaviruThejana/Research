import { NODE_API_URL } from "../config";
import { loadToken } from "../auth/tokenStorage";

/**
 * Centralised HTTP client for the Node API. Every request goes through
 * `api.*`, which:
 *  - attaches `Authorization: Bearer <jwt>` automatically,
 *  - sends JSON or multipart (FormData) with the correct headers,
 *  - applies a timeout,
 *  - turns every failure into an ApiError with a user-friendly message,
 *  - logs the user out globally when the server says the session expired (401).
 *
 * Why fetch rather than Axios: React Native's fetch builds the multipart
 * boundary for FormData itself. Axios (and hand-written headers) commonly set
 * `Content-Type: multipart/form-data` *without* the boundary, and then the
 * server (multer) can't parse the upload. Here Content-Type is never set for
 * FormData.
 */

const DEFAULT_TIMEOUT_MS = 30000;

let authToken = null;
let onUnauthorized = null;

/** Called by AuthProvider whenever the session changes. */
export function setAuthToken(token) {
  authToken = token || null;
}

/** AuthProvider registers its logout here so any 401 ends the session. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  /**
   * @param {string} message  safe to show to the user
   * @param {{status?: number, code?: string, requestId?: string}} [info]
   */
  constructor(message, { status = 0, code = "HTTP_ERROR", requestId } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = never reached the server
    this.code = code; // NETWORK_ERROR | TIMEOUT | UNAUTHORIZED | HTTP_ERROR
    this.requestId = requestId;
  }
}

async function request(path, { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { Accept: "application/json" };

  if (auth) {
    // In-memory first; fall back to storage in case a call happens before
    // AuthProvider finished restoring the session.
    const token = authToken || (await loadToken());
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (body instanceof FormData) {
    payload = body; // NO Content-Type: fetch adds "multipart/form-data; boundary=..."
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${NODE_API_URL}${path}`;

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError("The server took too long to respond. Please try again.", { code: "TIMEOUT" });
    }
    if (__DEV__) console.warn(`[api] ${method} ${url} failed:`, err.message);
    throw new ApiError(
      `Can't reach the server at ${NODE_API_URL}. Check that the API is running and your phone is on the same Wi-Fi as your PC.`,
      { code: "NETWORK_ERROR" }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const requestId = response.headers.get("x-request-id") || undefined;
  let data = null;
  try {
    data = await response.json();
  } catch (_err) {
    // empty or non-JSON body
  }

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status}).`;
    if (__DEV__) console.warn(`[api] ${method} ${path} -> ${response.status} ${message} (request ${requestId})`);

    // Expired/invalid session on a protected route: end it everywhere.
    if (response.status === 401 && auth && onUnauthorized) {
      onUnauthorized();
      throw new ApiError("Your session has expired. Please log in again.", {
        status: 401,
        code: "UNAUTHORIZED",
        requestId,
      });
    }
    throw new ApiError(message, { status: response.status, requestId });
  }

  return data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
};

/**
 * The `{ uri, name, type }` object React Native's FormData expects for a file.
 * `type` must be a real MIME type: the server only accepts image/jpeg and image/png.
 */
export function imageFormPart(uri, mimeType) {
  const type = mimeType === "image/png" ? "image/png" : "image/jpeg";
  return { uri, name: `lesion.${type === "image/png" ? "png" : "jpg"}`, type };
}
