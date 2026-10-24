import { NODE_API_URL } from "../config";
import { loadToken } from "../auth/tokenStorage";

/**
 * Centralised HTTP client for the Node API (port of mobile/src/api/client.js).
 * Every request goes through `api.*`, which:
 *  - attaches `Authorization: Bearer <jwt>` automatically,
 *  - sends JSON or multipart (FormData) with the correct headers,
 *  - applies a timeout,
 *  - turns every failure into an ApiError with a user-friendly message,
 *  - logs the user out globally when the server says the session expired (401).
 *
 * Content-Type is never set for FormData: the browser adds
 * "multipart/form-data; boundary=...", which multer needs to parse uploads.
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

const unreachable = () =>
  new ApiError("Can't reach the server. Check that the Node API is running (if you just started it, wait a few seconds) and try again.", {
    code: "NETWORK_ERROR",
  });

async function request(path, { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = { Accept: "application/json" };

  if (auth) {
    // In-memory first; fall back to storage in case a call happens before
    // AuthProvider finished restoring the session.
    const token = authToken || loadToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (body instanceof FormData) {
    payload = body; // NO Content-Type: the browser adds the multipart boundary
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
    if (import.meta.env.DEV) console.warn(`[api] ${method} ${url} failed:`, err.message);
    throw unreachable();
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
    // The Vite proxy answers 5xx with no JSON body when the Node API is down.
    if (!data && response.status >= 500) {
      if (import.meta.env.DEV) console.warn(`[api] ${method} ${path} -> ${response.status} (API unreachable via proxy?)`);
      throw unreachable();
    }

    const message = data?.error || `Request failed (${response.status}).`;
    if (import.meta.env.DEV) console.warn(`[api] ${method} ${path} -> ${response.status} ${message} (request ${requestId})`);

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
 * Adds a lesion image to a FormData under the field name the server expects.
 * The server accepts only image/jpeg and image/png; the capture screen
 * converts other formats before upload.
 * @param {FormData} form
 * @param {File|Blob} file
 */
export function appendImage(form, file) {
  const extension = file.type === "image/png" ? "png" : "jpg";
  form.append("image", file, `lesion.${extension}`);
}

/**
 * Image URLs from the API are absolute (e.g. http://localhost:5000/uploads/x.jpg),
 * which breaks on a phone browser where "localhost" is the phone. Rewrite
 * /uploads/... to the current origin so it goes through the same proxy.
 */
export function toAppUrl(url) {
  if (!url) return url;
  const match = url.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/);
  return match ? `${NODE_API_URL}${match[1]}` : url;
}
