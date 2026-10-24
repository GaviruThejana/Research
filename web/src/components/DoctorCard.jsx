import React from "react";
import { BadgeCheck, ChevronRight, Mail } from "lucide-react";
import { countryFlag } from "../constants/countries";
import { Badge } from "./ui";

function initials(name) {
  return String(name || "")
    .replace(/^(dr|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/**
 * Doctor profile card used by the directory and the "Get Doctor's Opinion"
 * list: avatar initials, verified tick, specialization badge, country flag,
 * email, and an optional call-to-action.
 *
 * Props: doctor, action? (element rendered on the right / below on phones),
 *        onSelect? (makes the whole card a button).
 */
export default function DoctorCard({ doctor, action, onSelect }) {
  const body = (
    <>
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-base font-bold text-white">
        {initials(doctor.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[17px] font-bold text-ink">{doctor.name}</span>
          <BadgeCheck size={18} className="shrink-0 text-primary" aria-label="Verified doctor" role="img" />
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="info">{doctor.specialization}</Badge>
          {doctor.country && (
            <Badge tone="neutral">
              <span aria-hidden="true">{countryFlag(doctor.country)}</span>
              {doctor.country}
            </Badge>
          )}
        </span>
        <span className="flex items-center gap-1.5 break-all text-sm text-muted">
          <Mail size={14} className="shrink-0" aria-hidden="true" />
          {doctor.email}
        </span>
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Select ${doctor.name}, ${doctor.specialization}, ${doctor.country}`}
        className="group flex w-full items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-lift"
      >
        {body}
        <span className="hidden items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary sm:inline-flex" aria-hidden="true">
          Select
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
        <ChevronRight size={18} className="shrink-0 text-slate-400 sm:hidden" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:border-slate-300 hover:shadow-lift sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">{body}</div>
      {action && <div className="sm:shrink-0">{action}</div>}
    </div>
  );
}
