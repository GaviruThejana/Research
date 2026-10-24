import React, { useEffect } from "react";
import { Link, Outlet, useMatches } from "react-router-dom";
import { ArrowLeft, Lock, ScanSearch, Stethoscope } from "lucide-react";
import AppCredits from "./AppCredits";
import Brand from "./Brand";

const HIGHLIGHTS = [
  { icon: ScanSearch, title: "AI skin screening", text: "Upload a photo and get a risk-rated result in seconds." },
  { icon: Stethoscope, title: "Verified dermatologists", text: "Send your result and history to a licensed doctor in your country." },
  { icon: Lock, title: "Private by design", text: "Your reports go only to the doctor you choose." },
];

/**
 * Login / registration layout. Desktop: brand panel + form. Phone: compact
 * brand header, form, credits.
 */
export default function AuthLayout() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => m.handle)?.handle || {};

  useEffect(() => {
    document.title = handle.title ? `${handle.title} · SkinAI` : "SkinAI";
  }, [handle.title]);

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-deep via-blue-800 to-primary p-10 text-white lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-cyan-300/10 blur-3xl" />
        <Brand inverted size="lg" />
        <div className="relative flex flex-col gap-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight">AI-assisted skin checks, reviewed by dermatologists.</h2>
            <p className="mt-3 text-base text-blue-100">Screen a skin lesion, understand the risk, and get a professional opinion.</p>
          </div>
          <ul className="flex flex-col gap-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-blue-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex flex-col gap-3">
          <p className="text-xs text-blue-100/80">Research prototype. SkinAI is not a medical device and does not replace a diagnosis by a doctor.</p>
          <AppCredits inverted className="justify-start text-left" />
        </div>
      </aside>

      {/* Form column */}
      <div className="flex min-h-dvh flex-1 flex-col">
        <main id="main" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
          <div className="w-full max-w-md animate-fade-in">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Brand />
            </div>
            {handle.backTo && (
              <Link to={handle.backTo} className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg pr-2 text-sm font-semibold text-primary hover:underline">
                <ArrowLeft size={16} aria-hidden="true" />
                Back to sign in
              </Link>
            )}
            <Outlet />
          </div>
        </main>
        <footer className="px-4 pb-6 lg:hidden">
          <AppCredits />
        </footer>
      </div>
    </div>
  );
}
