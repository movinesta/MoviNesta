import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "../lib/ui";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  title?: string;
  message: string;
  variant?: ToastVariant;
  createdAt: number;
};

type ToastInput = Omit<Toast, "id" | "createdAt"> & { durationMs?: number };

type ToastCtx = {
  push: (t: ToastInput) => void;
  clear: (id: string) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

function makeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const clear = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current[id];
    if (tm) {
      clearTimeout(tm);
      delete timers.current[id];
    }
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = makeId();
      const toast: Toast = {
        id,
        title: t.title,
        message: t.message,
        variant: t.variant ?? "info",
        createdAt: Date.now(),
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4));

      const duration = Number.isFinite(t.durationMs) ? (t.durationMs as number) : 3500;
      timers.current[id] = window.setTimeout(() => clear(id), duration);
    },
    [clear],
  );

  const value = useMemo(() => ({ push, clear }), [push, clear]);

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <ToastViewport toasts={toasts} onDismiss={clear} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function ToastViewport(props: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[22rem] flex-col gap-2">
      {props.toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto rounded-2xl border p-3 shadow-lg",
            "bg-zinc-950/90 backdrop-blur",
            t.variant === "success" && "border-emerald-800/60",
            t.variant === "error" && "border-red-800/60",
            t.variant === "info" && "border-zinc-800",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {t.title ? <div className="text-sm font-semibold text-zinc-100">{t.title}</div> : null}
              <div className="mt-0.5 break-words text-sm text-zinc-300">{t.message}</div>
            </div>
            <button
              className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              onClick={() => props.onDismiss(t.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
