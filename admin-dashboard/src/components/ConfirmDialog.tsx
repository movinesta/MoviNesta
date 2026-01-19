import React, { useEffect } from "react";
import { Button } from "./Button";
import { cn } from "../lib/ui";

export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onCancel]);

  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/40" onClick={props.onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold tracking-tight text-zinc-900">{props.title}</div>
        <div className="mt-2 text-sm text-zinc-600">{props.message}</div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant={props.danger ? "danger" : "primary"}
            className={cn(props.confirmDisabled && "opacity-60")}
            onClick={props.onConfirm}
            disabled={props.confirmDisabled}
          >
            {props.confirmText ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
