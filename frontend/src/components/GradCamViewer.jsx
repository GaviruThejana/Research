import React, { useEffect, useMemo, useState } from "react";

export default function GradCamViewer({ originalUrl, gradcamBase64 }) {
  const [mode, setMode] = useState("side-by-side"); // 'side-by-side' | 'toggle'
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Backend now sends full data URI (data:image/png;base64,...)
  // Use it directly if present, otherwise construct it
  const gradcamSrc = useMemo(() => {
    if (!gradcamBase64) return null;
    
    // If already a data URI, return as is
    if (gradcamBase64.startsWith("data:")) {
      return gradcamBase64;
    }
    
    // Otherwise, add the data URI prefix
    return `data:image/png;base64,${gradcamBase64}`;
  }, [gradcamBase64]);

  useEffect(() => setImageError(false), [gradcamSrc]);

  const handleImageError = () => {
    console.error("Grad-CAM image failed to load");
    setImageError(true);
  };

  const handleImageLoad = () => {
    console.log("Grad-CAM image loaded successfully");
    setImageError(false);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="eyebrow">Explainability &middot; Grad-CAM</span>
          <p className="mt-1 text-xs text-medical-slate-500">
            Visualizes regions that influenced the prediction
          </p>
        </div>
        {gradcamSrc && !imageError && (
          <div className="flex overflow-hidden rounded-lg border border-medical-slate-200 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setMode("side-by-side")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "side-by-side"
                  ? "bg-medical-blue-500 text-white"
                  : "bg-white text-medical-slate-600 hover:bg-medical-slate-50"
              }`}
            >
              Side-by-side
            </button>
            <button
              type="button"
              onClick={() => setMode("toggle")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "toggle"
                  ? "bg-medical-blue-500 text-white"
                  : "bg-white text-medical-slate-600 hover:bg-medical-slate-50"
              }`}
            >
              Toggle
            </button>
          </div>
        )}
      </div>

      {!gradcamSrc && (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-medical-slate-200 bg-medical-slate-50 px-6 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mb-3 text-medical-slate-400"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-medical-slate-600">Grad-CAM overlay unavailable</p>
          <p className="mt-1 text-xs text-medical-slate-400">
            The heatmap was not generated for this prediction.
          </p>
        </div>
      )}

      {imageError && (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-medical-blue-200 bg-medical-blue-50 px-6 text-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mb-3 text-medical-blue-400"
          >
            <circle cx="12" cy="12" r="10" strokeLinecap="round" />
            <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-sm text-medical-blue-900">Unable to load Grad-CAM overlay</p>
          <p className="mt-1 text-xs text-medical-blue-700">
            The heatmap image could not be displayed. Please try again.
          </p>
        </div>
      )}

      {gradcamSrc && !imageError && mode === "side-by-side" && (
        <div className="grid grid-cols-2 gap-4">
          <figure className="animate-fadeUp">
            <div className="overflow-hidden rounded-xl border border-medical-slate-200 bg-white shadow-sm">
              <img
                src={originalUrl}
                alt="Original lesion"
                className="h-56 w-full object-contain"
              />
            </div>
            <figcaption className="mt-2 text-center font-mono text-xs text-medical-slate-500">
              Original image
            </figcaption>
          </figure>
          <figure className="animate-fadeUp" style={{ animationDelay: "100ms" }}>
            <div className="overflow-hidden rounded-xl border border-medical-slate-200 bg-white shadow-sm">
              <img
                src={gradcamSrc}
                alt="Grad-CAM heatmap"
                className="h-56 w-full object-contain"
                onError={handleImageError}
                onLoad={handleImageLoad}
              />
            </div>
            <figcaption className="mt-2 text-center font-mono text-xs text-medical-slate-500">
              Grad-CAM overlay
            </figcaption>
          </figure>
        </div>
      )}

      {gradcamSrc && !imageError && mode === "toggle" && (
        <div className="animate-fadeUp">
          <div className="relative overflow-hidden rounded-xl border border-medical-slate-200 bg-white shadow-sm">
            <img
              src={showHeatmap ? gradcamSrc : originalUrl}
              alt={showHeatmap ? "Grad-CAM heatmap" : "Original lesion"}
              className="h-64 w-full object-contain"
              onError={showHeatmap ? handleImageError : undefined}
              onLoad={showHeatmap ? handleImageLoad : undefined}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHeatmap((prev) => !prev)}
            className="mt-3 w-full rounded-lg border border-medical-slate-200 bg-white py-2.5 text-xs font-semibold text-medical-slate-700 transition-colors hover:bg-medical-slate-50"
          >
            {showHeatmap ? "Show original image" : "Show Grad-CAM overlay"}
          </button>
        </div>
      )}
    </div>
  );
}
