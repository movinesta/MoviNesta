import React from "react";
import { cn } from "../lib/ui";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
  },
) {
  const { variant = "primary", className, ...rest } = props;
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300",
        variant === "primary" && "bg-zinc-900 text-white hover:bg-zinc-800",
        variant === "secondary" && "border border-zinc-200 bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
        variant === "ghost" && "bg-transparent text-zinc-700 hover:bg-zinc-100",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
    />
  );
}
