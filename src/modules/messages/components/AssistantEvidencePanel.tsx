import React from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/toasts";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { copyToClipboard } from "@/lib/copyToClipboard";

type ToolResultResponse = {
  ok: true;
  actionId: string;
  actionType: string;
  createdAt: string;
  conversationId: string;
  messageId: string;
  payload: unknown;
};

export default function AssistantEvidencePanel({
  handles,
  className,
}: {
  handles: string[];
  className?: string;
}) {
  const safeHandles = Array.isArray(handles)
    ? handles.map((h) => String(h)).filter(Boolean).slice(0, 50)
    : [];

  const [selected, setSelected] = React.useState<string | null>(safeHandles[0] ?? null);
  const [loading, setLoading] = React.useState(false);
  const [cache, setCache] = React.useState<Record<string, ToolResultResponse | null>>({});

  const fetchHandle = React.useCallback(
    async (actionId: string) => {
      if (!actionId) return;
      if (Object.prototype.hasOwnProperty.call(cache, actionId)) return;
      setLoading(true);
      try {
        const res = await callSupabaseFunction<ToolResultResponse>("assistant-tool-result", {
          actionId,
        });
        setCache((prev) => ({ ...prev, [actionId]: res }));
      } catch (e: any) {
        setCache((prev) => ({ ...prev, [actionId]: null }));
        toast.error(e?.message ?? "Couldn't load evidence.");
      } finally {
        setLoading(false);
      }
    },
    [cache],
  );

  React.useEffect(() => {
    if (selected) void fetchHandle(selected);
  }, [selected, fetchHandle]);

  if (safeHandles.length === 0) return null;

  const current = selected ? cache[selected] : null;

  return (
    <div className={className}>
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Evidence
            <Chip variant="outline" className="px-2 py-0 text-[11px]">
              {safeHandles.length}
            </Chip>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evidence</DialogTitle>
            <DialogDescription>
              Tool results the assistant used while generating this reply.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {safeHandles.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setSelected(h);
                    void fetchHandle(h);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    h === selected
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  title={h}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              {loading && !current ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : current ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">
                      {current.actionType}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {new Date(current.createdAt).toLocaleString()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const ok = await copyToClipboard(JSON.stringify(current.payload, null, 2));
                          if (ok) toast.show("Evidence copied.");
                          else toast.error("Couldn't copy evidence.");
                        }}
                      >
                        Copy JSON
                      </Button>
                    </div>
                  </div>

                  <pre className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-xs text-foreground">
                    {JSON.stringify(current.payload, null, 2)}
                  </pre>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No details available.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
