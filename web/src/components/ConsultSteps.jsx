import React from "react";
import { Check } from "lucide-react";

const STEPS = ["Choose doctor", "Medical history", "Send report"];

/** Progress indicator for the "Get Doctor's Opinion" flow (reduces uncertainty). */
export default function ConsultSteps({ current }) {
  return (
    <ol aria-label="Consultation steps" className="flex items-center gap-2">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-sage text-white" : active ? "bg-primary text-white ring-4 ring-primary/15" : "bg-slate-200 text-muted"
              }`}
            >
              {done ? <Check size={14} aria-hidden="true" /> : step}
            </span>
            <span className={`hidden text-sm sm:inline ${active ? "font-semibold text-ink" : "text-muted"}`}>
              {label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
            {step < STEPS.length && <span aria-hidden="true" className={`h-px flex-1 ${done ? "bg-sage" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
