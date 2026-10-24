import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/authApi";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";
import { TOKEN_KEY, clearToken, loadToken, saveToken } from "./tokenStorage";

const AuthContext = createContext(null);

/**
 * Holds the logged-in user and JWT (port of mobile/src/auth/AuthContext.js).
 *  - The token is persisted (tokenStorage -> localStorage) so the session
 *    survives reloads.
 *  - It's also handed to the API client, which attaches it to every request.
 *  - If any request returns 401, the client calls `logout`, and the route
 *    guards send the user back to /login.
 * Web addition: logging out (or in as someone else) in one tab is mirrored
 * in the others.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const startSession = useCallback(({ token: newToken, user: newUser }) => {
    if (!newToken) throw new Error("Login response did not include a token.");
    saveToken(newToken);
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    clearToken();
    setToken(null);
    setUser(null);
  }, []);

  // Any 401 from a protected route ends the session app-wide.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (import.meta.env.DEV) console.log("[auth] Session rejected by server; logging out");
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restore a saved session on load; validate it with the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = loadToken();
        if (!saved) return;
        setAuthToken(saved);
        const restoredUser = await authApi.fetchMe();
        if (!cancelled) {
          setUser(restoredUser);
          setToken(saved);
        }
      } catch (err) {
        // A 401 already cleared the token via the handler. For network errors,
        // keep it in storage but start at login, so the user can simply retry.
        setAuthToken(null);
        if (import.meta.env.DEV) console.log("[auth] Could not restore session:", err.message);
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Web: keep tabs in sync. Another tab logging out (token removed) or in
  // as someone else (token changed) is mirrored here.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) {
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } else if (event.newValue !== token) {
        window.location.reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [token]);

  /** Re-reads the user, e.g. so a doctor sees their approval without re-login. */
  const refreshUser = useCallback(async () => {
    if (!token) return;
    setUser(await authApi.fetchMe());
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      isRestoring,
      login: async (email, password) => startSession(await authApi.login(email, password)),
      registerPatient: async (form) => startSession(await authApi.registerPatient(form)),
      // Doctors aren't logged in after registering: they wait for admin approval.
      registerDoctor: async (form) => (await authApi.registerDoctor(form)).message,
      refreshUser,
      updateProfile: async (changes) => setUser(await authApi.updateProfile(changes)),
      logout,
    }),
    [token, user, isRestoring, startSession, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
