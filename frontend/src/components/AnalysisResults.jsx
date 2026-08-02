import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "./AppLayout.jsx";
import ConfidenceChart from "./ConfidenceChart.jsx";
import GradCamViewer from "./GradCamViewer.jsx";
import DermatologistCTA from "./DermatologistCTA.jsx";

function formatLabel(label) {
  return label
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getEmpatheticMessage(label, probability) {
  const lowerLabel = label.toLowerCase();
  
  if (lowerLabel === "mel") {
    return "Elevated risk pattern detected. Professional evaluation recommended.";
  } else if (lowerLabel === "bcc") {
    return "Pattern requires clinical review. Consultation advised.";
  } else if (probability > 0.7) {
    return "High confidence prediction. Consider professional consultation.";
  } else if (probability > 0.5) {
    return "Moderate confidence. Additional clinical review may be beneficial.";
  } else {
    return "Low confidence prediction. Professional evaluation recommended for certainty.";
  }
}

export default function AnalysisResults() {
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load result from sessionStorage
    const storedResult = sessionStorage.getItem("analysisResult");
    const storedImage = sessionStorage.getItem("previewImage");

    if (storedResult && storedImage) {
      setResult(JSON.parse(storedResult));
      setPreviewUrl(storedImage);
    }
    setLoading(false);
  }, []);

  const handleBack = () => {
    sessionStorage.removeItem("analysisResult");
    sessionStorage.removeItem("previewImage");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-medical-slate-200 border-t-medical-blue-500" />
            <p className="text-sm text-medical-slate-500">Loading results…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!result) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-medical-slate-300">
                <circle cx="12" cy="12" r="10" strokeLinecap="round" />
                <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-medical-slate-900 mb-2">No Results Found</h2>
            <p className="text-sm text-medical-slate-600 mb-6">
              Please complete an analysis to view results.
            </p>
            <Link
              to="/"
              onClick={handleBack}
              className="inline-block rounded-xl bg-medical-blue-500 px-6 py-3 text-sm font-semibold text-white hover:bg-medical-blue-600 transition-colors shadow-medical-soft"
            >
              Start New Analysis
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const confidencePct = (result.top1_probability * 100).toFixed(1);
  const empatheticMessage = getEmpatheticMessage(result.top1_label, result.top1_probability);

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <Link
            to="/"
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-medical-blue-600 hover:text-medical-blue-700 mb-4 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Analysis
          </Link>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-medical-sage-100">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-medical-sage-600">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-medical-slate-500">
              Analysis Complete
            </span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-medical-slate-900 sm:text-4xl">
            Analysis Results
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-medical-slate-600 leading-relaxed">
            Your lesion image has been analyzed using our multi-modal AI model. Below are the
            classification results with confidence scores and explainability visualization.
          </p>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Top Prediction */}
          <div className="space-y-6">
            <div className="rounded-xl border border-medical-slate-200 bg-white p-6 shadow-sm animate-fadeUp">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="eyebrow">Top prediction</span>
                  <h3 className="mt-1 font-display text-2xl text-medical-slate-900">
                    {formatLabel(result.top1_label)}
                  </h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-3xl font-semibold text-medical-blue-600">
                    {confidencePct}%
                  </span>
                  <span className="text-xs text-medical-slate-500">confidence</span>
                </div>
              </div>

              <div className="rounded-lg bg-medical-slate-50 px-4 py-3 mb-4">
                <p className="text-sm text-medical-slate-700">{empatheticMessage}</p>
              </div>

              <dl className="grid grid-cols-3 gap-3 border-t border-medical-slate-100 pt-4 font-mono text-[11px] text-medical-slate-500">
                <div>
                  <dt className="uppercase tracking-wide">Inference</dt>
                  <dd className="mt-0.5 text-medical-slate-800">{result.inference_time_ms} ms</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Device</dt>
                  <dd className="mt-0.5 text-medical-slate-800">{result.device_used}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide">Model</dt>
                  <dd className="mt-0.5 truncate text-medical-slate-800">{result.model_version}</dd>
                </div>
              </dl>
            </div>

            <DermatologistCTA topLabel={result.top1_label} probability={result.top1_probability} />
          </div>

          {/* Right Column - Confidence Distribution */}
          <div className="rounded-xl border border-medical-slate-200 bg-white p-6 shadow-sm animate-fadeUp" style={{ animationDelay: "100ms" }}>
            <span className="eyebrow">Top-{result.top_k.length} distribution</span>
            <div className="mt-4">
              <ConfidenceChart topK={result.top_k} />
            </div>
          </div>
        </div>

        {/* Grad-CAM Section */}
        <div className="mt-6 rounded-xl border border-medical-slate-200 bg-white p-6 shadow-sm animate-fadeUp" style={{ animationDelay: "200ms" }}>
          <GradCamViewer originalUrl={previewUrl} gradcamBase64={result.gradcam_base64} />
        </div>

        {/* Disclaimer */}
        <div className="mt-8 rounded-xl border border-medical-blue-200 bg-medical-blue-50 px-6 py-4">
          <div className="flex items-start gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-0.5 flex-shrink-0 text-medical-blue-600"
            >
              <circle cx="12" cy="12" r="10" strokeLinecap="round" />
              <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-medical-blue-900">Important Medical Disclaimer</p>
              <p className="mt-1 text-xs text-medical-blue-700 leading-relaxed">
                These results are for research and educational purposes only. This is not a definitive diagnosis.
                Always consult a board-certified dermatologist for professional medical evaluation and advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
