import React from "react";
import { cn } from "../lib/ui";

export function Card(props: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm", props.className)}>
      {props.title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-zinc-900">{props.title}</div>
          {props.right ? <div>{props.right}</div> : null}
        </div>
      ) : null}
      {props.children}
    </div>
  );
}
