import React from "react";

const HIGH_RISK_LABELS = ["mel", "bcc"]; // Melanoma, Basal Cell Carcinoma

export default function DermatologistCTA({ topLabel, probability }) {
  const isHighRisk = HIGH_RISK_LABELS.includes(topLabel.toLowerCase()) || probability > 0.6;
  
  if (!isHighRisk) return null;

  return (
    <div className="mt-6 rounded-xl border border-medical-sage-300 bg-medical-sage-50 px-5 py-4 animate-fadeUp">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-medical-sage-600"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-medical-slate-900">
            Requires clinical review
          </h4>
          <p className="mt-1 text-xs text-medical-slate-600 leading-relaxed">
            Based on the analysis, we recommend consulting a board-certified dermatologist for
            professional evaluation. This tool provides decision support, not a definitive diagnosis.
          </p>
          <button
            type="button"
            className="mt-3 rounded-lg bg-medical-sage-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-medical-sage-600 shadow-sage-soft"
          >
            Find a dermatologist near you
          </button>
        </div>
      </div>
    </div>
  );
}
