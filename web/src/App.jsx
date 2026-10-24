import React from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { DialogHost } from "./components/dialog";
import { router } from "./router";

/** Same provider order as mobile/App.js, with the router in place of NavigationContainer. */
export default function App() {
  return (
    // Catches crashes outside the routes; route-level errors use RouteError (router.jsx).
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
        {/* Renders showAlert() dialogs (web replacement for Alert.alert). */}
        <DialogHost />
      </AuthProvider>
    </ErrorBoundary>
  );
}
