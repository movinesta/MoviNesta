import React from "react";
import { cn } from "../lib/ui";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = props.variant ?? "primary";
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50",
        v === "primary" && "bg-zinc-100 text-zinc-950 hover:bg-white",
        v === "ghost" && "bg-transparent text-zinc-200 hover:bg-zinc-900/60",
        v === "danger" && "bg-red-500/90 text-white hover:bg-red-500",
        props.className,
      )}
    />
  );
}
