import React from "react";

export default function DisclaimerBanner() {
  return (
    <div className="w-full bg-medical-blue-50 border-b border-medical-blue-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-medical-blue-600"
            >
              <circle cx="12" cy="12" r="10" strokeLinecap="round" />
              <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-medical-blue-100 px-2 py-0.5 text-xs font-semibold text-medical-blue-700">
                Research Prototype
              </span>
            </div>
            <p className="mt-1 text-xs text-medical-blue-800 leading-relaxed">
              Clinical Decision Support Tool Only. Not a definitive diagnosis. Results must be reviewed by a qualified medical professional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
