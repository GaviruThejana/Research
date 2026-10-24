import React, { useId } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { COUNTRIES, countryFlag } from "../constants/countries";

/** Labelled dropdown of supported countries (replaces @react-native-picker/picker). */
export default function CountryPicker({ label = "Country", hint, value, onChange, error, disabled = false }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        error={error}
        describedBy={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      >
        {COUNTRIES.map((country) => (
          <option key={country} value={country}>
            {`${countryFlag(country)} ${country}`.trim()}
          </option>
        ))}
      </Select>
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-rose">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[13px] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Styled native <select> with a chevron, shared with the doctor-label picker. */
export function Select({ id, error, describedBy, className = "", children, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-12 w-full appearance-none rounded-xl border bg-surface pl-3.5 pr-11 text-base text-ink transition-colors focus:outline-none focus:ring-4 disabled:bg-subtle disabled:text-muted ${
          error ? "border-rose focus:ring-rose/15" : "border-line hover:border-slate-300 focus:border-primary focus:ring-primary/15"
        }`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}
