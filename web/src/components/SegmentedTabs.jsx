import React from "react";

/**
 * Accessible tab-like filter (radio group semantics: one active option).
 * options: [{ value, label, count? }]
 */
export default function SegmentedTabs({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors ${
              selected ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-subtle hover:text-ink"
            }`}
          >
            {option.label}
            {typeof option.count === "number" && (
              // Solid pill on the selected tab: white text on translucent white over blue fails AA (3.6:1).
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${selected ? "bg-white text-primary-dark" : "bg-subtle"}`}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
