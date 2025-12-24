import React from "react";
import { cn } from "../lib/ui";

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = props.variant ?? "primary";
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50",
        v === "primary" && "bg-zinc-900 text-white hover:bg-zinc-800",
        v === "ghost" && "bg-transparent text-zinc-700 hover:bg-zinc-100",
        v === "danger" && "bg-red-600 text-white hover:bg-red-700",
        props.className,
      )}
    />
  );
}
