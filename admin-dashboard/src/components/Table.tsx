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

type ThProps = React.ThHTMLAttributes<HTMLTableCellElement>;
type TdProps = React.TdHTMLAttributes<HTMLTableCellElement>;

export function Th({ className, ...props }: ThProps) {
  return <th className={cn("bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700", className)} {...props} />;
}
export function Td({ className, ...props }: TdProps) {
  return <td className={cn("border-t border-zinc-200 px-3 py-2 text-zinc-800", className)} {...props} />;
}
