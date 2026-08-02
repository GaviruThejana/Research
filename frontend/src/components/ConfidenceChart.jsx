import React from "react";

function formatLabel(label) {
  return label
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getRiskColor(probability, isTop) {
  if (isTop && probability > 0.7) return "bg-medical-blue-500";
  if (isTop && probability > 0.5) return "bg-medical-blue-400";
  if (isTop) return "bg-medical-sage-500";
  return "bg-medical-slate-300";
}

function getRiskLevel(probability) {
  if (probability > 0.7) return "High confidence";
  if (probability > 0.5) return "Moderate confidence";
  return "Low confidence";
}

export default function ConfidenceChart({ topK }) {
  if (!topK || topK.length === 0) return null;

  const maxProb = Math.max(...topK.map((entry) => entry.probability));

  return (
    <div className="space-y-4">
      {topK.map((entry, idx) => {
        const pct = (entry.probability * 100).toFixed(1);
        const widthPct = maxProb > 0 ? (entry.probability / maxProb) * 100 : 0;
        const isTop = idx === 0;
        const riskColor = getRiskColor(entry.probability, isTop);
        const riskLevel = isTop ? getRiskLevel(entry.probability) : null;

        return (
          <div key={entry.label} className="animate-fadeUp" style={{ animationDelay: `${idx * 80}ms` }}>
            <div className="mb-2 flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    isTop ? "text-medical-slate-900" : "text-medical-slate-700"
                  }`}
                >
                  {formatLabel(entry.label)}
                </span>
                {riskLevel && (
                  <span className="rounded-full bg-medical-blue-50 px-2 py-0.5 text-[10px] font-medium text-medical-blue-700">
                    {riskLevel}
                  </span>
                )}
              </div>
              <span className="font-mono text-sm font-semibold text-medical-blue-600">{pct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-medical-slate-100">
              <div
                className={`h-full rounded-full animate-progress ${riskColor}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
