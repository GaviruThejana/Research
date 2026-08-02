import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Topbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 border-b border-medical-slate-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Brand */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-medical-blue-500 shadow-medical-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="8" strokeLinecap="round" />
                <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-medical-slate-900">DermAI</h1>
              <p className="text-[11px] text-medical-slate-500">Skin Analysis</p>
            </div>
          </Link>

          {/* Center: Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isActive("/") ? "text-medical-blue-600" : "text-medical-slate-600 hover:text-medical-blue-600"
              }`}
            >
              Skin Analysis
            </Link>
            <Link
              to="/analysis-results"
              className={`text-sm font-medium transition-colors ${
                isActive("/analysis-results") ? "text-medical-blue-600" : "text-medical-slate-600 hover:text-medical-blue-600"
              }`}
            >
              Analysis Results
            </Link>
          </nav>

          {/* Right: Research Mode Badge */}
          <div className="hidden md:flex items-center">
            <span className="relative inline-flex items-center gap-2 rounded-full bg-medical-sage-100 px-3 py-1.5 text-xs font-medium text-medical-sage-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-medical-sage-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-medical-sage-500"></span>
              </span>
              Research Mode
            </span>
          </div>

          {/* Mobile: Hamburger Menu */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-medical-slate-600 hover:bg-medical-slate-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-medical-slate-200 bg-white">
          <div className="px-4 py-3 space-y-2">
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                isActive("/") 
                  ? "bg-medical-blue-50 text-medical-blue-700" 
                  : "text-medical-slate-600 hover:bg-medical-slate-50"
              }`}
            >
              Skin Analysis
            </Link>
            <Link
              to="/analysis-results"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                isActive("/analysis-results") 
                  ? "bg-medical-blue-50 text-medical-blue-700" 
                  : "text-medical-slate-600 hover:bg-medical-slate-50"
              }`}
            >
              Analysis Results
            </Link>
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-medical-sage-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-medical-sage-500"></span>
              </span>
              <span className="text-xs font-medium text-medical-sage-700">Research Mode</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
