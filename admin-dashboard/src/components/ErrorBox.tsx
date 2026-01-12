import React from "react";
import { Button } from "./Button";
import { cn } from "../lib/ui";
import { getAdminErrorMeta } from "../lib/api";

export function ErrorBox(props: { error: unknown; title?: string; className?: string }) {
  const meta = getAdminErrorMeta(props.error);

  const canCopy = typeof navigator !== "undefined" && !!navigator.clipboard && !!meta.requestId;

  return (
    <div className={cn("rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900", props.className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{props.title ?? "Something went wrong"}</div>
          <div className="mt-1 text-sm whitespace-pre-wrap">{meta.message}</div>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-rose-800/80">
            {meta.code ? <span className="rounded-full bg-white/60 px-2 py-0.5 font-mono">code: {meta.code}</span> : null}
            {meta.requestId ? <span className="rounded-full bg-white/60 px-2 py-0.5 font-mono">req: {meta.requestId}</span> : null}
          </div>
        </div>

        {canCopy ? (
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(meta.requestId));
              } catch {
                // ignore
              }
            }}
          >
            Copy req id
          </Button>
        ) : null}
      </div>
    </div>
  );
}
