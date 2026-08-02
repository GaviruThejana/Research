import React from "react";

const CHECKLIST_ITEMS = [
  { id: "image", label: "Lesion image uploaded" },
  { id: "age", label: "Patient age provided (optional)" },
  { id: "sex", label: "Biological sex selected (optional)" },
  { id: "site", label: "AnATOMICAL site selected (optional)" },
];

export default function AnalysisCTA({ imageUploaded, imageValidated, ageProvided, sexSelected, siteSelected, isAnalyzing, onAnalyze }) {
  const checklist = [
    { ...CHECKLIST_ITEMS[0], completed: imageUploaded && imageValidated },
    { ...CHECKLIST_ITEMS[1], completed: ageProvided },
    { ...CHECKLIST_ITEMS[2], completed: sexSelected },
    { ...CHECKLIST_ITEMS[3], completed: siteSelected },
  ];

  const canAnalyze = imageUploaded && imageValidated;

  return (
    <div className="rounded-xl border border-medical-blue-200 bg-gradient-to-br from-medical-blue-50 to-sky-50 p-5">
      <h3 className="text-sm font-semibold text-medical-slate-900 mb-2">Ready to analyze?</h3>
      <p className="text-xs text-medical-slate-600 mb-4">
        {imageUploaded && imageValidated
          ? "Your image is validated and ready for analysis."
          : imageUploaded
          ? "Validating image quality..."
          : "Upload a lesion image to begin analysis."}
      </p>

      <div className="space-y-2 mb-4">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <div
              className={`flex h-4 w-4 items-center justify-center rounded-full ${
                item.completed ? "bg-medical-sage-500" : "bg-medical-slate-200"
              }`}
            >
              {item.completed && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${item.completed ? "text-medical-slate-700" : "text-medical-slate-400"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAnalyze}
        disabled={!canAnalyze || isAnalyzing}
        className="w-full rounded-xl bg-medical-blue-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-medical-blue-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-medical-soft flex items-center justify-center gap-2"
      >
        {isAnalyzing ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analyzing lesion…
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Analyze Lesion
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[10px] text-medical-slate-500">
        Analysis typically completes in 3–8 seconds
      </p>
    </div>
  );
}
