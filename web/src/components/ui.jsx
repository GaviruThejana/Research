import React, { useId, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

/*
 * Shared UI primitives (web versions of mobile/src/components/ui.js).
 * Accessibility built in: every input has a <label>, errors are linked with
 * aria-describedby and announced, and all controls are at least 44 px tall.
 */

const fieldBase =
  "w-full rounded-xl border bg-surface text-base text-ink placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-4 disabled:bg-subtle disabled:text-muted";
const fieldOk = "border-line hover:border-slate-300 focus:border-primary focus:ring-primary/15";
const fieldBad = "border-rose focus:border-rose focus:ring-rose/15";

/** Label + error/hint wiring shared by every form control. */
function Field({ id, label, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] font-medium text-rose" role="alert">
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

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

/** Labelled text input (or <textarea> when multiline) with optional leading icon. */
export function TextField({ label, error, hint, icon: Icon, multiline = false, className = "", id, ...inputProps }) {
  const autoId = useId();
  const inputId = id || autoId;
  const Control = multiline ? "textarea" : "input";
  return (
    <div className={className}>
      <Field id={inputId} label={label} hint={hint} error={error}>
        <div className="relative">
          {Icon && !multiline && (
            <Icon size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          )}
          <Control
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, hint)}
            className={`${fieldBase} ${error ? fieldBad : fieldOk} ${multiline ? "min-h-28 px-3.5 py-3" : `min-h-12 ${Icon ? "pl-11 pr-3.5" : "px-3.5"}`}`}
            {...inputProps}
          />
        </div>
      </Field>
    </div>
  );
}

/** Password input with a show/hide toggle (reduces typing errors on phones). */
export function PasswordField({ label = "Password", error, hint, icon: Icon, className = "", id, ...inputProps }) {
  const autoId = useId();
  const inputId = id || autoId;
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <Field id={inputId} label={label} hint={hint} error={error}>
        <div className="relative">
          {Icon && <Icon size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
          <input
            id={inputId}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(inputId, error, hint)}
            className={`${fieldBase} ${error ? fieldBad : fieldOk} min-h-12 ${Icon ? "pl-11" : "pl-3.5"} pr-12`}
            {...inputProps}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </Field>
    </div>
  );
}

const VARIANTS = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-dark",
  secondary: "border border-line bg-surface text-ink shadow-sm hover:border-slate-300 hover:bg-subtle",
  danger: "border border-rose/40 bg-surface text-rose hover:border-rose hover:bg-rose-soft",
  success: "bg-sage text-white shadow-sm hover:bg-emerald-800",
  ghost: "text-primary hover:bg-primary-soft",
};
const SIZES = { md: "min-h-12 px-5 text-base", sm: "min-h-11 px-4 text-sm" };

/** Button with variants, an optional leading icon and a loading state. */
export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  loadingText,
  disabled = false,
  type = "button",
  className = "",
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : Icon && <Icon size={18} aria-hidden="true" />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

/** Form-level error message, announced to screen readers. */
export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose/20 bg-rose-soft px-3.5 py-3 text-sm text-rose">
      <AlertCircle size={18} className="mt-px shrink-0" aria-hidden="true" />
      <p className="whitespace-pre-line">{children}</p>
    </div>
  );
}

/** Replacement for ActivityIndicator. */
export function Spinner({ className = "text-primary", size = 20, label = "Loading" }) {
  return (
    <span role="status" className={`inline-flex ${className}`}>
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Centered spinner with a caption (e.g. "Checking session…"). */
export function LoadingScreen({ message }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 p-6">
      <Spinner size={32} label={message || "Loading"} />
      {message && <p className="text-[15px] text-muted">{message}</p>}
    </div>
  );
}

/** Elevated white card. `interactive` adds the hover lift used by clickable cards. */
export function Card({ as: Tag = "div", interactive = false, className = "", children, ...props }) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface shadow-card ${interactive ? "transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-lift" : ""} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

const TONES = {
  neutral: "bg-subtle text-muted ring-line",
  info: "bg-primary-soft text-primary-dark ring-primary/20",
  accent: "bg-accent-soft text-accent ring-accent/20",
  success: "bg-sage-soft text-sage ring-sage/20",
  warning: "bg-amber-soft text-amber ring-amber/20",
  danger: "bg-rose-soft text-rose ring-rose/20",
};

/** Small status pill. */
export function Badge({ tone = "neutral", icon: Icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Shimmering placeholder block shown while data loads. */
export function Skeleton({ className = "" }) {
  return (
    <div aria-hidden="true" className={`relative overflow-hidden rounded-lg bg-slate-200/70 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/** Screen-reader announcement + visual skeleton list for loading states. */
export function SkeletonList({ count = 3, label = "Loading", itemClassName = "h-24" }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className={`w-full rounded-2xl ${itemClassName}`} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Friendly empty state with an icon, text and optional action. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-surface px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon size={24} aria-hidden="true" />
        </span>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action}
    </div>
  );
}
