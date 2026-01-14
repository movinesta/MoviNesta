import React from "react";
import { cn } from "../lib/ui";

export function EmptyState(props: { title?: string; message?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200 bg-white p-6", props.className)}>
      <div className="text-sm font-semibold text-zinc-900">{props.title ?? "No results"}</div>
      <div className="mt-1 text-sm text-zinc-600">{props.message ?? "Try adjusting your filters or search query."}</div>
      {props.children ? <div className="mt-4">{props.children}</div> : null}
    </div>
  );
}
