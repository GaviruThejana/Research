import React from "react";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

export const RISK_STYLES = {
  High: { tone: "bg-rose-soft text-rose ring-rose/25", bar: "bg-rose", icon: ShieldAlert, advice: "Please consult a dermatologist soon." },
  Moderate: { tone: "bg-amber-soft text-amber ring-amber/25", bar: "bg-amber-600", icon: Shield, advice: "A dermatologist review is recommended." },
  Low: { tone: "bg-sage-soft text-sage ring-sage/25", bar: "bg-sage", icon: ShieldCheck, advice: "Keep an eye on changes in size, shape or colour." },
};

/** "High Risk" / "Moderate Risk" / "Low Risk" pill with an icon (never colour alone). */
export default function RiskBadge({ level, size = "md" }) {
  const style = RISK_STYLES[level];
  if (!style) return null;
  const Icon = style.icon;
  const sizing = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[13px]";
  return (
    <span className={`inline-flex items-center gap-1.5 self-start rounded-full font-bold ring-1 ring-inset ${sizing} ${style.tone}`}>
      <Icon size={size === "lg" ? 16 : 14} aria-hidden="true" />
      {level} Risk
    </span>
  );
}
