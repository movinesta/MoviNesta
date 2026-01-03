import { useSyncExternalStore } from "react";

export type ToastVariant = "info" | "success" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
};

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const createId = () =>
  crypto.randomUUID?.() ?? `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getToastsSnapshot = () => toasts;

export const subscribeToToasts = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const dismissToast = (id: string) => {
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
};

export const pushToast = (
  toast: Omit<Toast, "id"> & {
    durationMs?: number;
  },
) => {
  const id = createId();
  const toastWithId: Toast = {
    variant: "info",
    ...toast,
    id,
  };

  toasts = [...toasts, toastWithId];
  emit();

  const duration = toast.durationMs ?? 4500;
  if (duration !== 0) {
    window.setTimeout(() => dismissToast(id), duration);
  }

  return id;
};

export const useToasts = () => useSyncExternalStore(subscribeToToasts, getToastsSnapshot);
