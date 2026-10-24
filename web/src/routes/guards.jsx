import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LoadingScreen } from "../components/ui";

/*
 * Route guards: the web version of the mobile RootNavigator's
 * `token ? <main stack> : <auth stack>` switch.
 */

/**
 * Logged-in users only. Optionally restrict by role or a custom rule, e.g.
 *   <RequireAuth roles={["admin"]} />
 *   <RequireAuth allow={canReviewFeedback} />     (see auth/roles.js)
 * Unauthenticated visitors go to /login and come back here after logging in;
 * logged-in users without access are sent home.
 */
export function RequireAuth({ roles, allow }) {
  const { token, user, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <LoadingScreen message="Checking session…" />;
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  if (allow && !allow(user)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Login/register pages: logged-in users are sent on to the app. */
export function PublicOnly() {
  const { token, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <LoadingScreen message="Checking session…" />;
  if (token) {
    const from = location.state?.from;
    const target = from ? `${from.pathname}${from.search || ""}` : "/";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
