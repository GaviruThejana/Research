import React from "react";
import { Skeleton } from "../ui";

const TONES = {
  info: "bg-primary-soft text-primary",
  warning: "bg-amber-soft text-amber",
  success: "bg-sage-soft text-sage",
  danger: "bg-rose-soft text-rose",
};

/** Dashboard summary card: icon, label and a big number (skeleton while loading). */
export default function StatCard({ icon: Icon, label, value, tone = "info", hint }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        {value === null || value === undefined ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className="text-2xl font-bold tabular-nums text-ink">{value}</p>
        )}
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
