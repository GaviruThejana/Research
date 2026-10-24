import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Accessible modal built on <dialog>: focus is trapped and Escape closes it
 * natively; focus returns to the opener when it closes.
 */
export default function Modal({ open, onClose, title, description, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-lg font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
