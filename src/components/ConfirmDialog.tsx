import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui/button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

/**
 * Reusable confirmation dialog component (UI-only; no business logic changes).
 * - Uses theme tokens for dark/light parity
 * - Uses consistent Button focus/target sizing
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Confirmation action failed:", error);
    } finally {
      setIsConfirming(false);
    }
  };

  const isBusy = isConfirming || isLoading;

  const iconTone =
    variant === "danger"
      ? "text-destructive"
      : variant === "warning"
        ? "text-amber-500"
        : "text-primary";

  const confirmVariant: "default" | "destructive" =
    variant === "danger" ? "destructive" : "default";
  const confirmClassName =
    variant === "warning"
      ? "bg-amber-500 text-white hover:bg-amber-500/90 focus-visible:ring-amber-500"
      : undefined;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
        <div className="card-pad flex items-start justify-between gap-3 border-b border-border/60">
          <div className="flex min-w-0 items-start gap-3">
            {variant !== "default" ? (
              <span
                className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-muted ${iconTone}`}
              >
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
            ) : null}

            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close dialog"
            className="icon-hit"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="card-pad flex items-center justify-end gap-2 pt-3">
          <Button type="button" onClick={onClose} variant="secondary" disabled={isBusy}>
            {cancelLabel}
          </Button>

          <Button
            type="button"
            onClick={handleConfirm}
            variant={confirmVariant}
            className={confirmClassName}
            disabled={isBusy}
          >
            {isBusy ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
