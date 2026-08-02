import React from "react";

const GUIDELINES = [
  { text: "Good natural or diffuse lighting", valid: true },
  { text: "Sharp focus — lesion clearly visible", valid: true },
  { text: "Close-up photo, lesion fills frame", valid: true },
  { text: "Include a ruler or coin for scale if possible", valid: true },
  { text: "Avoid direct flash — causes glare", valid: false },
  { text: "No filters, cropping, or heavy editing", valid: false },
];

export default function ImageGuidelines() {
  return (
    <div className="rounded-xl border border-medical-blue-200 bg-medical-blue-50 p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-medical-blue-600"
        >
          <path d="M9 18h6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 22h4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2a7 7 0 00-7 7c0 2.386 1.194 4.5 3 5.7V17a2 2 0 002 2h4a2 2 0 002-2v-2.3c1.806-1.2 3-3.314 3-5.7a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 className="text-sm font-semibold text-medical-slate-900">Photo Guidelines</h3>
      </div>
      <ul className="space-y-2">
        {GUIDELINES.map((guideline, index) => (
          <li key={index} className="flex items-start gap-2 text-xs text-medical-slate-700">
            <span className="mt-0.5 flex-shrink-0">
              {guideline.valid ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-medical-sage-500">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-medical-blue-400">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span>{guideline.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
