import { dismissToast, pushToast, type ToastVariant } from "./toast-store";

const getTitleForVariant = (variant: ToastVariant | undefined) => {
  switch (variant) {
    case "success":
      return "Success";
    case "error":
      return "Something went wrong";
    default:
      return "Notice";
  }
};

export const toast = {
  show: (
    message: string,
    options?: {
      title?: string;
      variant?: ToastVariant;
      description?: string;
      durationMs?: number;
    },
  ) =>
    pushToast({
      title: options?.title ?? getTitleForVariant(options?.variant),
      description: message,
      variant: options?.variant,
      durationMs: options?.durationMs,
    }),
  success: (message: string, options?: { title?: string; durationMs?: number }) =>
    pushToast({
      title: options?.title ?? getTitleForVariant("success"),
      description: message,
      variant: "success",
      durationMs: options?.durationMs,
    }),
  error: (message: string, options?: { title?: string; durationMs?: number }) =>
    pushToast({
      title: options?.title ?? getTitleForVariant("error"),
      description: message,
      variant: "error",
      durationMs: options?.durationMs,
    }),
  dismiss: dismissToast,
};

export type UseToast = typeof toast;
