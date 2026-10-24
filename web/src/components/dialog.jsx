import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/**
 * Web replacement for React Native's Alert.alert: same call shape, rendered
 * as an accessible modal (<dialog>) instead of a native system alert.
 *
 *   showAlert("Report sent", message);
 *   showAlert("Report incorrect result?", "…", [
 *     { text: "Cancel", style: "cancel" },
 *     { text: "Report", style: "destructive", onPress: handleSubmit },
 *   ]);
 *
 * It returns a promise that resolves with the pressed button's text, so
 * screens can also `await` it. <DialogHost /> must be mounted once (App.jsx).
 */

let enqueue = null;

export function showAlert(title, message, buttons = [{ text: "OK" }]) {
  return new Promise((resolve) => {
    const dialog = { title, message, buttons, resolve };
    if (enqueue) enqueue(dialog);
    else {
      // Host not mounted (shouldn't happen): fall back to the browser's alert.
      window.alert([title, message].filter(Boolean).join("\n\n"));
      resolve(buttons[0]?.text);
    }
  });
}

const BUTTON_STYLES = {
  default: "bg-primary text-white shadow-sm hover:bg-primary-dark",
  cancel: "border border-line bg-surface text-ink hover:bg-subtle",
  destructive: "bg-rose text-white shadow-sm hover:bg-red-800",
};

// Icon + colour for the dialog, inferred from its title/buttons so callers
// keep the Alert.alert signature. The icon means colour is never the only cue.
function toneFor(dialog) {
  const title = dialog.title.toLowerCase();
  if (dialog.buttons.some((b) => b.style === "destructive")) return { icon: AlertTriangle, cls: "bg-amber-soft text-amber" };
  if (/(fail|can't|couldn't|not sent|error)/.test(title)) return { icon: XCircle, cls: "bg-rose-soft text-rose" };
  if (/(sent|thank|success)/.test(title)) return { icon: CheckCircle2, cls: "bg-sage-soft text-sage" };
  if (/pending/.test(title)) return { icon: Info, cls: "bg-amber-soft text-amber" };
  return { icon: Info, cls: "bg-primary-soft text-primary" };
}

export function DialogHost() {
  const [queue, setQueue] = useState([]);
  const dialogRef = useRef(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = (dialog) => setQueue((q) => [...q, dialog]);
    return () => {
      enqueue = null;
    };
  }, []);

  // Open the native <dialog> modally whenever there's something to show.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (current && !el.open) el.showModal();
    if (!current && el.open) el.close();
  }, [current]);

  const close = (button) => {
    setQueue((q) => q.slice(1));
    current?.resolve(button?.text);
    // Run the action after the dialog is dismissed, like Alert.alert does.
    if (button?.onPress) setTimeout(button.onPress, 0);
  };

  // Escape key: behaves like the "cancel" button if there is one.
  const onCancel = (event) => {
    event.preventDefault();
    const cancel = current?.buttons.find((b) => b.style === "cancel") || current?.buttons[current.buttons.length - 1];
    close(cancel);
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={onCancel}
      aria-labelledby="dialog-title"
      aria-describedby={current?.message ? "dialog-message" : undefined}
      className="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-surface p-0 text-ink shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      {current && (
        <div className="flex flex-col gap-3 p-6">
          {(() => {
            const { icon: Icon, cls } = toneFor(current);
            return (
              <span className={`flex h-11 w-11 items-center justify-center rounded-full ${cls}`}>
                <Icon size={22} aria-hidden="true" />
              </span>
            );
          })()}
          <h2 id="dialog-title" className="text-lg font-bold">
            {current.title}
          </h2>
          {current.message && (
            <p id="dialog-message" className="whitespace-pre-line text-[15px] leading-relaxed text-muted">
              {current.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {current.buttons.map((button, i) => (
              <button
                key={button.text}
                type="button"
                // Initial focus: "Cancel" when there is one (an accidental Enter
                // never confirms a destructive action), otherwise the last button.
                autoFocus={
                  current.buttons.some((b) => b.style === "cancel") ? button.style === "cancel" : i === current.buttons.length - 1
                }
                onClick={() => close(button)}
                className={`min-h-11 rounded-xl px-5 text-[15px] font-semibold transition-colors ${
                  BUTTON_STYLES[button.style] || BUTTON_STYLES.default
                }`}
              >
                {button.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
