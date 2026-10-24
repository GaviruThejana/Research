import React, { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, LayoutDashboard, LogOut, Stethoscope } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { canUseAdminPortal } from "../auth/roles";
import AppCredits from "./AppCredits";
import Brand from "./Brand";

/**
 * Layout for logged-in patient & doctor pages.
 *
 * Each route declares its header in `handle` (see router.jsx):
 *   { title: "AI Result" }            back button + title (task flow)
 *   { title: "Home", root: true }     brand + navigation (top-level page)
 *   { backTo: "/" }                    where "back" goes if there's no history
 *
 * Phones: top-level pages get a bottom navigation bar (thumb-reachable);
 * task flows (result, send report) hide it to keep attention on the task.
 * Desktop: the same links sit in the top bar.
 */
export default function AppShell() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => m.handle)?.handle || {};
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = handle.title && handle.title !== "Home" ? `${handle.title} · SkinAI` : "SkinAI";
  }, [handle.title]);

  // "default" key = first page of this visit (deep link or reload): no in-app history to go back to.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate(handle.backTo || "/", { replace: true }));
  const links = navLinks(user);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-primary focus:shadow-lift">
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
        <div className="mx-auto flex h-16 w-full max-w-content items-center gap-2 px-4">
          {handle.root ? (
            <Link to="/" aria-label="SkinAI home" className="rounded-xl">
              <Brand />
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                aria-label="Back"
                className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle"
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <h1 className="truncate text-[17px] font-semibold text-ink">{handle.title}</h1>
            </>
          )}

          <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                    isActive ? "bg-primary-soft text-primary-dark" : "text-muted hover:bg-subtle hover:text-ink"
                  }`
                }
              >
                <link.icon size={18} aria-hidden="true" />
                {link.label}
              </NavLink>
            ))}
            <span className="mx-2 h-6 w-px bg-line" aria-hidden="true" />
            <span className="max-w-[10rem] truncate text-sm text-muted" title={user?.email}>
              {user?.name}
            </span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-subtle hover:text-ink"
            >
              <LogOut size={18} aria-hidden="true" />
              Log out
            </button>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className={`mx-auto w-full max-w-content flex-1 px-4 pt-5 ${handle.root ? "pb-28 md:pb-8" : "pb-8"} focus:outline-none`}>
        <Outlet />
      </main>

      <footer className={`mx-auto w-full max-w-content px-4 ${handle.root ? "pb-24 md:pb-6" : "pb-6"}`}>
        <div className="border-t border-line pt-4">
          <AppCredits />
        </div>
      </footer>

      {handle.root && <BottomNav links={links} onLogout={logout} />}
    </div>
  );
}

function navLinks(user) {
  return [
    { to: "/", label: "Home", icon: Home },
    { to: "/doctors", label: "Doctors", icon: Stethoscope },
    canUseAdminPortal(user) && { to: "/admin", label: "Admin", icon: LayoutDashboard },
  ].filter(Boolean);
}

/** Phone navigation: large, thumb-reachable targets at the bottom of the screen. */
function BottomNav({ links, onLogout }) {
  const item = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-content">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === "/"} className={({ isActive }) => `${item} ${isActive ? "text-primary" : "text-muted"}`}>
            {({ isActive }) => (
              <>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? "bg-primary-soft" : ""}`}>
                  <link.icon size={20} aria-hidden="true" />
                </span>
                {link.label}
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onLogout} className={`${item} text-muted`}>
          <span className="flex h-7 w-12 items-center justify-center">
            <LogOut size={20} aria-hidden="true" />
          </span>
          Log out
        </button>
      </div>
    </nav>
  );
}
