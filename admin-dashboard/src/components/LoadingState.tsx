import React from "react";
import { cn } from "../lib/ui";

export function LoadingState(props: { label?: string; className?: string }) {
  const label = props.label ?? "Loading…";
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600", props.className)}>
      <span
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
