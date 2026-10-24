import { showAlert } from "../components/dialog";

/**
 * Turns any thrown value into a message that's safe and useful to show.
 * ApiError messages (src/api/client.js) are already user-friendly; anything
 * else (a bug) gets a generic message instead of a raw technical string.
 */
export function friendlyMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (err.name === "ApiError") {
    if (err.status >= 500) {
      return `${err.message}${err.requestId ? `\n\n(Reference: ${err.requestId})` : ""}`;
    }
    return err.message;
  }
  if (import.meta.env.DEV) console.error(err);
  return fallback;
}

/**
 * Shows an alert dialog for a failed action. Session-expiry errors are not
 * shown: the app has already returned to the login screen by then.
 */
export function showErrorAlert(title, err, fallback) {
  if (err?.code === "UNAUTHORIZED") return;
  showAlert(title, friendlyMessage(err, fallback));
}
