import React from "react";
import ImageUploader from "./Dropzone.jsx";
import ImageGuidelines from "./ImageGuidelines.jsx";
import ExampleImageTypes from "./ExampleImageTypes.jsx";
import MetadataForm from "./MetadataForm.jsx";
import AnalysisCTA from "./AnalysisCTA.jsx";
import PrivacyData from "./PrivacyData.jsx";

export default function SkinAnalysisContent({
  file,
  previewUrl,
  metadata,
  isValidating,
  isValidated,
  oodError,
  analysisError,
  onFileSelected,
  onFileRemove,
  onMetadataChange,
  onAnalyze,
  isAnalyzing,
}) {
  const ageProvided = metadata.age !== "" && Number(metadata.age) >= 0;
  const sexSelected = metadata.sex !== "";
  const siteSelected = metadata.anatomical_site !== "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-medical-blue-100">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-medical-blue-600">
              <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-medical-slate-500">
            Lesion Analysis
          </span>
        </div>
        <h1 className="font-display text-3xl font-semibold text-medical-slate-900 sm:text-4xl">
          Skin Lesion Classification
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-medical-slate-600 leading-relaxed">
          Upload a lesion image along with patient metadata for an explainable, multi-modal AI analysis.
          The system combines image features with clinical context to provide a ranked differential diagnosis.
        </p>
      </div>

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT COLUMN (3/5 width on XL) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Step 1 Card - Upload Lesion Image */}
          <div className="rounded-2xl border border-medical-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-blue-500 text-white text-sm font-semibold">
                1
              </div>
              <h2 className="text-base font-semibold text-medical-slate-900">Upload Lesion Image</h2>
            </div>
            <ImageUploader
              file={file}
              previewUrl={previewUrl}
              onFileSelected={onFileSelected}
              onRemove={onFileRemove}
              error={oodError}
              isValidating={isValidating}
              isValidated={isValidated}
            />
          </div>

          {/* Photo Guidelines Card */}
          <ImageGuidelines />

          {/* Example Image Types Card */}
          <ExampleImageTypes />
        </div>

        {/* RIGHT COLUMN (2/5 width on XL) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 2 Card - Patient Metadata */}
          <div className="rounded-2xl border border-medical-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-medical-blue-500 text-white text-sm font-semibold">
                2
              </div>
              <h2 className="text-base font-semibold text-medical-slate-900">Patient Metadata</h2>
            </div>
            <MetadataForm
              metadata={metadata}
              onChange={onMetadataChange}
              disabled={isAnalyzing}
            />
          </div>

          {/* Analysis CTA Card */}
          <AnalysisCTA
            imageUploaded={!!file}
            imageValidated={isValidated}
            ageProvided={ageProvided}
            sexSelected={sexSelected}
            siteSelected={siteSelected}
            isAnalyzing={isAnalyzing}
            onAnalyze={onAnalyze}
          />
          {analysisError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {analysisError}
            </p>
          )}

          {/* Privacy & Data Card */}
          <PrivacyData />
        </div>
      </div>
    </div>
  );
}
