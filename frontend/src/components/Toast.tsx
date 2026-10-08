import React from "react";

export type ToastState = { title: string; message?: string } | null;

export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <b>{toast.title}</b>
      {toast.message ? <div className="muted">{toast.message}</div> : null}
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

