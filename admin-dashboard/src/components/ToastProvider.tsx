import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../lib/ui";

export type ToastVariant = "info" | "success" | "error";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  durationMs: number;
};

type ToastCtx = {
  push: (t: { title?: string; message: string; variant?: ToastVariant; durationMs?: number }) => void;
  dismiss: (id: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: { title?: string; message: string; variant?: ToastVariant; durationMs?: number }) => {
      const toast: Toast = {
        id: uid(),
        title: t.title,
        message: t.message,
        variant: t.variant ?? "info",
        createdAt: Date.now(),
        durationMs: Number.isFinite(t.durationMs) ? Math.max(800, Number(t.durationMs)) : 3000,
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-2xl border bg-white p-3 shadow-sm",
              t.variant === "info" && "border-zinc-200",
              t.variant === "success" && "border-emerald-200",
              t.variant === "error" && "border-red-200",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.title ? <div className="text-sm font-semibold text-zinc-900">{t.title}</div> : null}
                <div className={cn("text-sm text-zinc-800", t.title ? "mt-0.5" : "")}>{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ToastProvider missing");
  return ctx;
}
