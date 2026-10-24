import React from "react";

/**
 * Horizontal confidence bar, exposed to screen readers as a meter
 * ("Model confidence, 43 percent").
 */
export default function ConfidenceMeter({ value, label = "Model confidence", barClassName = "bg-primary", compact = false }) {
  if (typeof value !== "number") return null;
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${compact ? "text-sm" : "text-sm font-medium"} text-muted`}>{label}</span>
        <span className={`${compact ? "text-sm" : "text-base"} font-bold tabular-nums text-ink`}>{pct.toFixed(1)}%</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${pct.toFixed(1)} percent`}
        className={`${compact ? "h-1.5" : "h-2.5"} w-full overflow-hidden rounded-full bg-slate-200`}
      >
        <div className={`h-full rounded-full ${barClassName} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
