import React, { useEffect, useMemo, useState } from "react";
import { safeLocalStorageGetItem } from "@/lib/storage";

const LAST_INGEST_KEY = "mn_swipe_last_ingest_v1";
const BACKOFF_KEY = "mn_swipe_events_backoff_v1";

type LastIngest = {
  at: number;
  requestId?: string;
  accepted: number;
  rejected: number;
  retry: number;
  shouldRetry: boolean;
  issues?: Array<{ code?: string; message?: string; clientEventId?: string; eventType?: string }>;
};

type BackoffState = { failCount: number; nextAt: number; updatedAt: number };

type Props = {
  active?: {
    deckId?: string | null;
    recRequestId?: string | null;
    position?: number | null;
    dedupeKey?: string | null;
    mediaItemId?: string | null;
    source?: string | null;
  } | null;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = safeLocalStorageGetItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function fmtTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export const SwipeDebugPanel: React.FC<Props> = ({ active }) => {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const t = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(t);
  }, []);

  const ingest = useMemo(() => readJson<LastIngest>(LAST_INGEST_KEY), [now]);
  const backoff = useMemo(() => readJson<BackoffState>(BACKOFF_KEY), [now]);

  if (!import.meta.env.DEV) return null;

  const blockedMs = backoff?.nextAt && backoff.nextAt > now ? backoff.nextAt - now : 0;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[9999] w-[340px] select-text rounded-xl border border-border/60 bg-background/80 p-3 text-xs text-foreground shadow-lg backdrop-blur">
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        <div className="font-semibold">Swipe Debug</div>
        <div className="text-[10px] text-muted-foreground">DEV only</div>
      </div>

      <div className="mt-2 space-y-2">
        <div>
          <div className="text-[11px] font-semibold">Ingest</div>
          {ingest ? (
            <div className="mt-1 space-y-1 text-muted-foreground">
              <div>
                <span className="text-foreground">at</span>: {fmtTime(ingest.at)}
              </div>
              {ingest.requestId ? (
                <div>
                  <span className="text-foreground">request</span>: {ingest.requestId}
                </div>
              ) : null}
              <div>
                <span className="text-foreground">accepted</span>: {ingest.accepted} ·{" "}
                <span className="text-foreground">rejected</span>: {ingest.rejected} ·{" "}
                <span className="text-foreground">retry</span>: {ingest.retry}
              </div>
              <div>
                <span className="text-foreground">shouldRetry</span>: {String(ingest.shouldRetry)}
              </div>
              {Array.isArray(ingest.issues) && ingest.issues.length ? (
                <div className="mt-1 rounded-lg border border-border/60 bg-muted/40 p-2">
                  <div className="text-[10px] font-semibold text-foreground">Issues (first 5)</div>
                  <ul className="mt-1 list-disc pl-4">
                    {ingest.issues.slice(0, 5).map((it, idx) => (
                      <li key={idx} className="break-words">
                        <span className="text-foreground">{it.code ?? "ISSUE"}</span>
                        {it.eventType ? ` [${it.eventType}]` : ""}: {it.message ?? ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 text-muted-foreground">No recent ingest snapshot.</div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold">Backoff</div>
          {backoff ? (
            <div className="mt-1 space-y-1 text-muted-foreground">
              <div>
                <span className="text-foreground">failCount</span>: {backoff.failCount}
              </div>
              <div>
                <span className="text-foreground">nextAt</span>:{" "}
                {backoff.nextAt ? fmtTime(backoff.nextAt) : "0"}
              </div>
              {blockedMs ? (
                <div>
                  <span className="text-foreground">blocked</span>: {Math.ceil(blockedMs / 1000)}s
                </div>
              ) : (
                <div>
                  <span className="text-foreground">blocked</span>: no
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-muted-foreground">No backoff state.</div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold">Active card</div>
          {active ? (
            <div className="mt-1 space-y-1 text-muted-foreground">
              {active.mediaItemId ? (
                <div>
                  <span className="text-foreground">media</span>: {active.mediaItemId}
                </div>
              ) : null}
              <div>
                <span className="text-foreground">deck</span>: {active.deckId ?? "null"}
              </div>
              <div>
                <span className="text-foreground">recRequest</span>: {active.recRequestId ?? "null"}
              </div>
              <div>
                <span className="text-foreground">position</span>: {active.position ?? "null"}
              </div>
              <div className="break-all">
                <span className="text-foreground">dedupeKey</span>: {active.dedupeKey ?? "null"}
              </div>
              {active.source ? (
                <div>
                  <span className="text-foreground">source</span>: {active.source}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 text-muted-foreground">No active card.</div>
          )}
        </div>
      </div>
    </div>
  );
};
