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
    <div className="fixed inset-x-0 top-4 z-50 mx-auto flex w-full max-w-xl flex-col gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${variantStyles[toast.variant ?? "info"]} shadow-lg shadow-black/30 backdrop-blur-md`}
        >
          <div className="flex items-start justify-between px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-sm leading-snug text-slate-200">{toast.description}</p>
              )}
              {toast.action ? (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="inline-flex items-center rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    {toast.action.label}
                  </button>
                </div>
              ) : null}
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
