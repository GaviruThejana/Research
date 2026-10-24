import React from "react";
import { Code2, Heart } from "lucide-react";

export const AUTHORS = ["Gaviru Thejana", "Kavindu Sankalpa"];

/**
 * Author attribution shown on the login/register pages, in the app footer
 * and in the admin portal. Subtle by design so it never competes with
 * clinical content.
 *
 * The sentence is one text run (with real spaces) so screen readers read it
 * naturally; the icons are decorative.
 *
 * `inverted` = light text for the blue brand panel.
 */
export default function AppCredits({ inverted = false, className = "" }) {
  const tone = inverted ? "text-blue-100/80" : "text-slate-500";
  const strong = inverted ? "text-white" : "text-slate-700";
  return (
    <p className={`flex items-center justify-center gap-1.5 text-center text-sm ${tone} ${className}`}>
      <Code2 size={14} aria-hidden="true" className="shrink-0" />
      <span>
        Created and Developed by <span className={`font-semibold ${strong}`}>{AUTHORS[0]}</span> and{" "}
        <span className={`font-semibold ${strong}`}>{AUTHORS[1]}</span>
      </span>
      <Heart size={13} aria-hidden="true" className={`shrink-0 ${inverted ? "fill-rose-300 text-rose-300" : "fill-rose-400 text-rose-400"}`} />
    </p>
  );
}
