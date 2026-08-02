import React from "react";

const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "unknown", label: "Unknown" },
];

const SITE_OPTIONS = [
  { value: "head/neck", label: "Head & Neck" },
  { value: "upper extremity", label: "Upper Extremity" },
  { value: "lower extremity", label: "Lower Extremity" },
  { value: "torso", label: "Trunk (Front)" },
  { value: "torso-back", label: "Trunk (Back)" },
  { value: "palms/soles", label: "Palms & Soles" },
  { value: "oral/genital", label: "Genital Area" },
  { value: "oral/mucosal", label: "Oral / Mucosal" },
  { value: "unknown", label: "Unknown / Other" },
];

export default function MetadataForm({ metadata, onChange, disabled }) {
  const handleField = (field) => (event) => {
    const value = field === "age" ? event.target.value.replace(/[^0-9]/g, "") : event.target.value;
    onChange({ ...metadata, [field]: value });
  };

  const handleSexSelect = (value) => {
    onChange({ ...metadata, sex: value });
  };

  const handleSiteSelect = (value) => {
    onChange({ ...metadata, anatomical_site: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="age" className="mb-1.5 block text-xs font-semibold text-medical-slate-800">
          Patient Age
        </label>
        <div className="relative">
          <input
            id="age"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 42"
            value={metadata.age}
            onChange={handleField("age")}
            disabled={disabled}
            className="w-full rounded-xl border border-medical-slate-200 bg-white px-3.5 py-2.5 pr-12 text-sm text-medical-slate-900 placeholder:text-medical-slate-400 focus:border-medical-blue-400 focus:outline-none focus:ring-2 focus:ring-medical-blue-100 disabled:opacity-50"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-medical-slate-400">
            years
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-medical-slate-800">
          Biological Sex
        </label>
        <div className="flex flex-wrap gap-2">
          {SEX_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => !disabled && handleSexSelect(opt.value)}
              disabled={disabled}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                metadata.sex === opt.value
                  ? "bg-medical-blue-500 text-white shadow-medical-soft"
                  : "border border-medical-slate-200 bg-white text-medical-slate-700 hover:border-medical-blue-300 hover:bg-medical-blue-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-medical-slate-800">
          Anatomical Site
        </label>
        <div className="grid grid-cols-3 gap-2">
          {SITE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => !disabled && handleSiteSelect(opt.value)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                metadata.anatomical_site === opt.value
                  ? "border-medical-blue-500 bg-medical-blue-50 text-medical-blue-700"
                  : "border-medical-slate-200 bg-white text-medical-slate-600 hover:border-medical-blue-300 hover:bg-medical-blue-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={metadata.anatomical_site === opt.value ? "text-medical-blue-600" : "text-medical-slate-400"}
              >
                <circle cx="12" cy="12" r="10" strokeLinecap="round" />
                <path d="M12 8v4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] font-medium leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
