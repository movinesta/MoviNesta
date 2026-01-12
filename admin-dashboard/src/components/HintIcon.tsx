import React from "react";
import { cn } from "../lib/ui";

export function HintIcon(props: { onClick: () => void; title?: string; className?: string }) {
  return (
    <button
      type="button"
      title={props.title ?? "Hint"}
      aria-label={props.title ?? "Hint"}
      onClick={props.onClick}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 bg-white text-[11px] font-bold text-zinc-600 shadow-sm hover:bg-zinc-50",
        "focus:outline-none focus:ring-2 focus:ring-zinc-300",
        props.className,
      )}
    >
      i
    </button>
  );
}
