import React from "react";

export default function PrivacyData() {
  return (
    <div className="rounded-xl border border-medical-slate-200 bg-medical-slate-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-medical-slate-500"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-medical-slate-900 mb-2">Privacy & Data</h3>
          <p className="text-xs text-medical-slate-600 leading-relaxed">
            Images are processed in-session only. No patient data is stored or transmitted beyond this analysis session.
          </p>
        </div>
      </div>
    </div>
  );
}
