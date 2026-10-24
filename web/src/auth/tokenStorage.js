/**
 * Persists the JWT between visits (web replacement for expo-secure-store).
 *
 * localStorage is readable by any script on this origin, so an XSS bug would
 * expose the token. React escapes rendered text by default and nothing here
 * injects raw HTML; keep it that way. (An httpOnly cookie would be safer but
 * needs backend changes.) Every access is wrapped: storage can throw in
 * private mode or when site data is blocked.
 */
export const TOKEN_KEY = "skinai.authToken";

export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (_err) {
    // Storage unavailable: the session still works until the tab is closed.
  }
}

export function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (_err) {
    return null;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (_err) {
    // nothing to clear
  }
}
