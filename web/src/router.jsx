import React from "react";
import { Link, Navigate, Outlet, createBrowserRouter, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import AppShell from "./components/AppShell";
import AuthLayout from "./components/AuthLayout";
import AdminLayout from "./components/admin/AdminLayout";
import AppCredits from "./components/AppCredits";
import { PublicOnly, RequireAuth } from "./routes/guards";
import LoginScreen from "./screens/auth/LoginScreen";
import RegisterScreen from "./screens/auth/RegisterScreen";
import DoctorRegisterScreen from "./screens/auth/DoctorRegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import AIResultScreen from "./screens/AIResultScreen";
import SelectDoctorScreen from "./screens/SelectDoctorScreen";
import ConsultDoctorScreen from "./screens/ConsultDoctorScreen";
import DoctorDirectoryScreen from "./screens/DoctorDirectoryScreen";
import DoctorApprovalScreen from "./screens/admin/DoctorApprovalScreen";
import FeedbackReviewScreen from "./screens/admin/FeedbackReviewScreen";
import { useAuth } from "./auth/AuthContext";
import { canReviewFeedback, canUseAdminPortal, isAdmin } from "./auth/roles";

/*
 * Mobile stack screen (mobile/App.js)  ->  web route           layout
 *
 *   Login            /login                                    AuthLayout (public only)
 *   RegisterPatient  /register                                 AuthLayout (public only)
 *   RegisterDoctor   /register/doctor                          AuthLayout (public only)
 *   Home             /                                         AppShell   (logged in)
 *   Result           /results/:predictionId                    AppShell
 *   SelectDoctor     /results/:predictionId/doctors            AppShell
 *   ConsultDoctor    /results/:predictionId/consult/:doctorId  AppShell
 *   Doctors          /doctors                                  AppShell
 *
 * Admin portal (AdminLayout):
 *   /admin           -> first section the user can access
 *   /admin/doctors   doctor approvals                         admins
 *   /admin/feedback  expert review queue                      admins + expert doctors
 *
 * Mobile passed { image, prediction, doctor } as navigation params (memory
 * only). Here the ids live in the URL, so a page refresh or shared link still
 * works: screens use router state when present and refetch by id otherwise.
 * `handle` configures each layout's header.
 */
export const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "/login", element: <LoginScreen />, handle: { title: "Sign in" } },
              { path: "/register", element: <RegisterScreen />, handle: { title: "Create patient account", backTo: "/login" } },
              { path: "/register/doctor", element: <DoctorRegisterScreen />, handle: { title: "Doctor registration", backTo: "/login" } },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: "/", element: <HomeScreen />, handle: { title: "Home", root: true } },
              { path: "/doctors", element: <DoctorDirectoryScreen />, handle: { title: "Find a Dermatologist", root: true } },
              { path: "/results/:predictionId", element: <AIResultScreen />, handle: { title: "AI Result", backTo: "/" } },
              { path: "/results/:predictionId/doctors", element: <SelectDoctorScreen />, handle: { title: "Get Doctor's Opinion" } },
              { path: "/results/:predictionId/consult/:doctorId", element: <ConsultDoctorScreen />, handle: { title: "Send Report" } },
            ],
          },
          {
            path: "/admin",
            element: <RequireAuth allow={canUseAdminPortal} />,
            children: [
              {
                element: <AdminLayout />,
                children: [
                  { index: true, element: <AdminIndex /> },
                  {
                    element: <RequireAuth allow={isAdmin} />,
                    children: [{ path: "doctors", element: <DoctorApprovalScreen />, handle: { title: "Doctor approvals" } }],
                  },
                  {
                    element: <RequireAuth allow={canReviewFeedback} />,
                    children: [{ path: "feedback", element: <FeedbackReviewScreen />, handle: { title: "Expert review queue" } }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

/** /admin: open the first section this user can use. */
function AdminIndex() {
  const { user } = useAuth();
  return <Navigate to={isAdmin(user) ? "/admin/doctors" : "/admin/feedback"} replace />;
}

/** Shown if a route throws while rendering (React Router's error boundary). */
function RouteError() {
  const error = useRouteError();
  console.error("[route error]", error);
  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-canvas p-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-soft text-rose">
        <AlertTriangle size={24} aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="text-[15px] text-muted">The page hit an unexpected problem. Your data is safe on the server.</p>
      {import.meta.env.DEV && <pre className="whitespace-pre-wrap rounded-lg bg-subtle p-3 font-mono text-xs text-rose">{String(error?.message || error)}</pre>}
      <Link to="/" reloadDocument className="font-semibold text-primary hover:underline">
        Back to home
      </Link>
      <AppCredits className="mt-6" />
    </main>
  );
}
