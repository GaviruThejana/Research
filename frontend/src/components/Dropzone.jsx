import React, { useCallback, useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export default function ImageUploader({ file, previewUrl, onFileSelected, error, isValidating, isValidated, onRemove }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const validateAndEmit = useCallback(
    (candidate) => {
      if (!candidate) return;
      if (!ACCEPTED_TYPES.includes(candidate.type)) {
        onFileSelected(null, "Unsupported file type. Use JPEG, PNG, WebP, or HEIC.");
        return;
      }
      if (candidate.size > MAX_SIZE_BYTES) {
        onFileSelected(null, "Image exceeds the 10 MB upload limit.");
        return;
      }
      onFileSelected(candidate, null);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      validateAndEmit(dropped);
    },
    [validateAndEmit]
  );

  const handleChange = (event) => {
    const selected = event.target.files?.[0];
    validateAndEmit(selected);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !previewUrl && inputRef.current?.click()}
        onKeyDown={(e) => !previewUrl && (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          isDragging
            ? "border-medical-blue-400 bg-medical-blue-50"
            : "border-medical-slate-200 bg-medical-slate-50 hover:border-medical-blue-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleChange}
          className="hidden"
        />

        {isValidating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 rounded-2xl">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-medical-blue-200 border-t-medical-blue-500" />
            <p className="mt-3 text-sm text-medical-slate-600">Validating image quality…</p>
          </div>
        )}

        {previewUrl ? (
          <div className="relative h-full w-full">
            <img
              src={previewUrl}
              alt="Lesion preview"
              className="h-full w-full rounded-2xl object-contain p-3"
            />
            {isValidated && (
              <div className="absolute top-3 right-3 rounded-full bg-medical-sage-100 px-3 py-1 text-xs font-medium text-medical-sage-700">
                ✓ Image validated
              </div>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-medical-slate-600 shadow-sm hover:bg-white hover:text-medical-slate-900 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={isDragging ? "text-medical-blue-500" : "text-medical-blue-400"}
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-sm font-medium text-medical-slate-800">
                {isDragging ? "Release to upload" : "Drag & drop your lesion photo here"}
              </p>
              <p className="mt-1 text-xs text-medical-slate-500">
                or browse files — JPEG, PNG, WEBP, HEIC
              </p>
              <p className="mt-1 text-[10px] text-medical-slate-400">
                Maximum file size: 10 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-medical-blue-200 bg-medical-blue-50 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mt-0.5 flex-shrink-0 text-medical-blue-600"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-xs font-medium text-medical-blue-900">Image Quality Warning</p>
            <p className="mt-1 text-xs text-medical-blue-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
