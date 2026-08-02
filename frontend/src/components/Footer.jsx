import React from "react";

export default function Footer() {
  return (
    <footer className="w-full border-t border-medical-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-medical-slate-400"
            >
              <circle cx="12" cy="12" r="10" strokeLinecap="round" />
              <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-medium text-medical-slate-600">Important Notice</span>
          </div>
          <p className="max-w-2xl text-xs text-medical-slate-500 leading-relaxed">
            DermAI is a research prototype for clinical decision support only. Results are not a substitute for professional medical diagnosis. Always consult a qualified dermatologist for definitive evaluation.
          </p>
        </div>
      </div>
    </footer>
  );
}
