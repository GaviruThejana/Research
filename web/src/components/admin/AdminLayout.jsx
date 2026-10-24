import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, LogOut, Menu, PanelLeftClose, PanelLeftOpen, UserCheck, X } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { canReviewFeedback, isAdmin } from "../../auth/roles";
import AppCredits from "../AppCredits";
import Brand from "../Brand";

const COLLAPSE_KEY = "skinai.adminSidebarCollapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch (_err) {
    return false;
  }
}

/**
 * Admin portal layout: collapsible sidebar on desktop (state remembered per
 * browser), slide-in drawer on phones. Each section is only listed for users
 * who can open it; the server enforces the same rules.
 */
export default function AdminLayout() {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => m.handle)?.handle || {};
  const { user, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.title = `${handle.title || "Admin"} · SkinAI Admin`;
  }, [handle.title]);

  // Close the phone drawer after navigating.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Escape closes the drawer.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch (_err) {
        // not persisted; fine
      }
      return !value;
    });
  };

  const sections = [
    isAdmin(user) && { to: "/admin/doctors", label: "Doctor approvals", icon: UserCheck },
    canReviewFeedback(user) && { to: "/admin/feedback", label: "Expert review queue", icon: ClipboardCheck },
  ].filter(Boolean);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-primary focus:shadow-lift">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-64"}`}
        aria-label="Admin navigation"
      >
        <div className={`flex h-16 items-center border-b border-line ${collapsed ? "justify-center" : "justify-between px-4"}`}>
          {!collapsed && (
            <Link to="/admin" className="rounded-xl" aria-label="Admin portal home">
              <Brand />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
          </button>
        </div>
        <SidebarNav sections={sections} collapsed={collapsed} onLogout={logout} />
      </aside>

      {/* Phone drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-fade-in flex-col bg-surface shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Brand />
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <SidebarNav sections={sections} collapsed={false} onLogout={logout} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-subtle lg:hidden"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Admin portal</p>
            <h1 className="truncate text-lg font-bold leading-tight text-ink">{handle.title}</h1>
          </div>
          <span className="ml-auto hidden max-w-[14rem] truncate text-sm text-muted sm:block" title={user?.email}>
            {user?.name} · {isAdmin(user) ? "Admin" : "Expert doctor"}
          </span>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus:outline-none lg:px-8">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 lg:px-8">
          <div className="border-t border-line pt-4">
            <AppCredits />
          </div>
        </footer>
      </div>
    </div>
  );
}

function SidebarNav({ sections, collapsed, onLogout }) {
  const item = `flex min-h-11 items-center gap-3 rounded-xl text-sm font-semibold transition-colors ${collapsed ? "justify-center px-0" : "px-3"}`;
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {!collapsed && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Manage</p>}
      {sections.map((section) => (
        <NavLink
          key={section.to}
          to={section.to}
          title={collapsed ? section.label : undefined}
          aria-label={collapsed ? section.label : undefined}
          className={({ isActive }) => `${item} ${isActive ? "bg-primary-soft text-primary-dark" : "text-muted hover:bg-subtle hover:text-ink"}`}
        >
          <section.icon size={20} aria-hidden="true" className="shrink-0" />
          {!collapsed && section.label}
        </NavLink>
      ))}
      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-3">
        <Link to="/" title={collapsed ? "Back to app" : undefined} aria-label={collapsed ? "Back to app" : undefined} className={`${item} text-muted hover:bg-subtle hover:text-ink`}>
          <ArrowLeft size={20} aria-hidden="true" className="shrink-0" />
          {!collapsed && "Back to app"}
        </Link>
        <button type="button" onClick={onLogout} title={collapsed ? "Log out" : undefined} aria-label={collapsed ? "Log out" : undefined} className={`${item} text-muted hover:bg-subtle hover:text-ink`}>
          <LogOut size={20} aria-hidden="true" className="shrink-0" />
          {!collapsed && "Log out"}
        </button>
      </div>
    </nav>
  );
}
