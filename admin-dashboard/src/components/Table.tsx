import React from "react";
import { cn } from "../lib/ui";

export function Table(props: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-zinc-200", props.className)}>
      <table className="w-full text-left text-sm">
        {props.children}
      </table>
    </div>
  );
}

export function Th(props: { children: React.ReactNode; className?: string }) {
  return <th className={cn("bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700", props.className)}>{props.children}</th>;
}
export function Td(props: { children: React.ReactNode; className?: string }) {
  return <td className={cn("border-t border-zinc-200 px-3 py-2 text-zinc-800", props.className)}>{props.children}</td>;
}
