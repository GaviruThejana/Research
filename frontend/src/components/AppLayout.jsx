import React from "react";
import DisclaimerBanner from "./DisclaimerBanner.jsx";
import Topbar from "./Topbar.jsx";
import Footer from "./Footer.jsx";

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-medical-slate-50">
      <DisclaimerBanner />
      <Topbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
