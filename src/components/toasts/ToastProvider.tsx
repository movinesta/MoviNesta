import React from "react";
import { dismissToast, useToasts } from "./toast-store";

const variantStyles = {
  info: "bg-slate-800 text-slate-50 border border-slate-700",
  success: "bg-emerald-700/90 text-emerald-50 border border-emerald-600",
  error: "bg-rose-700/90 text-rose-50 border border-rose-600",
};

const closeButtonBase =
  "ml-3 rounded-md px-2 py-1 text-xs font-semibold transition hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";

const ToastProvider: React.FC = () => {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 flex w-full max-w-xl -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${variantStyles[toast.variant ?? "info"]} shadow-lg shadow-black/30 backdrop-blur-md`}
        >
          <div className="flex items-start justify-between px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">{toast.title}</p>
              {toast.description && <p className="mt-1 text-sm leading-snug text-slate-200">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className={`${closeButtonBase} text-inherit`}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastProvider;
