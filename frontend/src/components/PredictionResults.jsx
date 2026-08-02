import React from "react";
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

export default function PredictionResults({ result, previewUrl }) {
  if (!result) return null;

  // Handle OOD images
  if (result.is_ood) {
    return (
      <div className="animate-fadeUp">
        <div className="rounded-xl border border-medical-blue-200 bg-medical-blue-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                width="24"
                height="24"
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
            <div>
              <h3 className="text-lg font-semibold text-medical-blue-900">
                Invalid Image Warning
              </h3>
              <p className="mt-2 text-sm text-medical-blue-700">
                {result.ood_reason || "Please upload a clear, focused close-up photo of a skin lesion."}
              </p>
              <p className="mt-3 text-xs text-medical-blue-600">
                Ensure good lighting, the lesion is in focus, and the image shows the affected area clearly.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const confidencePct = (result.top1_probability * 100).toFixed(1);
  const empatheticMessage = getEmpatheticMessage(result.top1_label, result.top1_probability);

  return (
    <div className="animate-fadeUp space-y-6">
      <div className="rounded-xl border border-medical-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

        <div className="mt-4 rounded-lg bg-medical-slate-50 px-4 py-3">
          <p className="text-sm text-medical-slate-700">{empatheticMessage}</p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-medical-slate-100 pt-4 font-mono text-[11px] text-medical-slate-500">
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

      <div className="rounded-xl border border-medical-slate-200 bg-white p-5 shadow-sm">
        <span className="eyebrow">Top-{result.top_k.length} distribution</span>
        <div className="mt-4">
          <ConfidenceChart topK={result.top_k} />
        </div>
      </div>

      <DermatologistCTA topLabel={result.top1_label} probability={result.top1_probability} />

      <div className="rounded-xl border border-medical-slate-200 bg-white p-5 shadow-sm">
        <GradCamViewer originalUrl={previewUrl} gradcamBase64={result.gradcam_base64} />
      </div>
    </div>
  );
}
