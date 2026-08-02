import React from "react";

const EXAMPLE_TYPES = [
  { name: "Melanoma", color: "bg-purple-500" },
  { name: "Benign Nevus", color: "bg-amber-700" },
  { name: "Basal Cell", color: "bg-blue-900" },
  { name: "Seb. Keratosis", color: "bg-emerald-800" },
];

export default function ExampleImageTypes() {
  return (
    <div className="rounded-xl border border-medical-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-medical-slate-900 mb-4">Example Image Types</h3>
      <div className="grid grid-cols-2 gap-3">
        {EXAMPLE_TYPES.map((type) => (
          <div key={type.name} className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-lg ${type.color} flex-shrink-0`} />
            <span className="text-xs text-medical-slate-700">{type.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
