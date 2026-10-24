import React from "react";
import { HeartPulse } from "lucide-react";

/** SkinAI logo mark + wordmark. `inverted` for dark/brand backgrounds. */
export default function Brand({ inverted = false, size = "md" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-2xl" : "h-9 w-9 rounded-xl";
  const icon = size === "lg" ? 24 : 20;
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`flex ${box} items-center justify-center ${inverted ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-primary text-white shadow-sm"}`}
        aria-hidden="true"
      >
        <HeartPulse size={icon} strokeWidth={2.25} />
      </span>
      <span className={`${text} font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>
        Skin<span className={inverted ? "text-blue-200" : "text-primary"}>AI</span>
      </span>
    </span>
  );
}
