import React, { useMemo, useState } from "react";
import { cn } from "../lib/ui";
import { diffLines } from "../lib/diff";

function prettyJson(value: any): string {
  try {
    if (value === undefined) return "undefined";
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return "[unprintable]";
    }
  }
}

export function JsonDiff(props: { before: any; after: any; className?: string }) {
  const { before, after, className } = props;
  const [showUnchanged, setShowUnchanged] = useState(false);

  const beforeText = useMemo(() => prettyJson(before), [before]);
  const afterText = useMemo(() => prettyJson(after), [after]);

  const ops = useMemo(() => diffLines(beforeText, afterText, { maxLines: 350 }), [beforeText, afterText]);

  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
        <div className="text-xs font-semibold text-zinc-700">Diff</div>
        <label className="flex items-center gap-2 text-[11px] text-zinc-600">
          <input type="checkbox" checked={showUnchanged} onChange={(e) => setShowUnchanged(e.target.checked)} />
          Show unchanged
        </label>
      </div>

      <pre className="max-h-60 overflow-auto px-3 py-2 text-xs leading-5">
        {ops
          .filter((op) => showUnchanged || op.type !== "equal")
          .map((op, idx) => (
            <div
              key={idx}
              className={cn(
                "whitespace-pre",
                op.type === "add" && "bg-emerald-50 text-emerald-900",
                op.type === "del" && "bg-rose-50 text-rose-900",
                op.type === "equal" && "text-zinc-600",
              )}
            >
              <span className="select-none font-mono opacity-60">{op.type === "add" ? "+" : op.type === "del" ? "-" : " "}</span>{" "}
              {op.line}
            </div>
          ))}
      </pre>
    </div>
  );
}
