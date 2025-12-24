import React from "react";
import { cn } from "../lib/ui";

export function StatCard(props: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm", props.className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-600">{props.title}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{props.value}</div>
          {props.subtitle ? <div className="mt-1 text-xs text-zinc-500">{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className="text-zinc-500">{props.right}</div> : null}
      </div>
    </div>
  );
}
