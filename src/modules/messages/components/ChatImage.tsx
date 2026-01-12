import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Minus, Plus, RotateCcw, X } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { CHAT_MEDIA_BUCKET } from "../chatMedia";
import { getPublicStorageUrl, isHttpUrl, resolveStorageUrl } from "../storageUrls";

/**
 * Displays an image attachment stored in Supabase Storage using a signed URL.
 * Includes small caching + "retry once" behavior for expired URLs.
 */
export const ChatImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const mountedRef = useRef(true);
  const activePathRef = useRef<string | null>(null);
  const retriedRef = useRef(false);
  const touchStartAtRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);

  const canOpenViewer = useMemo(() => {
    // Don't open for broken links.
    return Boolean(path);
  }, [path]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    activePathRef.current = path || null;
    retriedRef.current = false;

    setUrl(null);
    setError(false);

    if (!path) {
      setError(true);
      return () => {
        cancelled = true;
      };
    }

    if (isHttpUrl(path)) {
      setUrl(path);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const resolved = await resolveStorageUrl(CHAT_MEDIA_BUCKET, path, {
          allowPublicFallback: true,
          // Use cache by default; we'll force-refresh on the first onError.
          forceRefresh: false,
          allowHttp: true,
        });

        if (cancelled || activePathRef.current !== path || !mountedRef.current) return;

        if (!resolved) {
          setError(true);
          return;
        }

        setUrl(resolved);
      } catch {
        if (!cancelled && mountedRef.current && activePathRef.current === path) {
          setError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (error) {
    return <div className="mt-1 text-xs text-muted-foreground">Image unavailable.</div>;
  }

  if (!url) {
    return <div className="mt-1 h-32 w-40 animate-pulse rounded-xl bg-border/40" />;
  }

  return (
    <>
      <div
        className="mt-1 overflow-hidden rounded-xl border border-border bg-background/80"
        role={canOpenViewer ? "button" : undefined}
        tabIndex={canOpenViewer ? 0 : undefined}
        onTouchStart={() => {
          touchStartAtRef.current = Date.now();
          suppressNextClickRef.current = false;
        }}
        onTouchEnd={() => {
          if (touchStartAtRef.current == null) return;
          const elapsed = Date.now() - touchStartAtRef.current;

          // If the user long-pressed (messages uses ~500ms), don't also open the viewer on click.
          suppressNextClickRef.current = elapsed >= 450;
          touchStartAtRef.current = null;
        }}
        onTouchCancel={() => {
          touchStartAtRef.current = null;
          suppressNextClickRef.current = false;
        }}
        onClick={(event) => {
          // Prevent the message bubble click handler from toggling message actions.
          event.stopPropagation();
          if (!canOpenViewer) return;
          if (suppressNextClickRef.current) return;
          setViewerOpen(true);
        }}
        onKeyDown={(event) => {
          if (!canOpenViewer) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setViewerOpen(true);
          }
        }}
        onContextMenu={(event) => {
          // Prevent long-press / context menu from opening message actions.
          event.stopPropagation();
        }}
        aria-label="Open image"
      >
        <img
          src={url}
          alt="Attachment"
          className="max-h-64 w-full cursor-zoom-in object-cover"
          loading="lazy"
          onError={async () => {
            if (!mountedRef.current || activePathRef.current !== path) return;

            // External URLs cannot be resolved through Supabase, so surface the error immediately.
            if (isHttpUrl(path)) {
              setError(true);
              return;
            }

            try {
              // If we already fell back to the public URL and it fails, there's nothing else to do.
              const publicUrl = getPublicStorageUrl(CHAT_MEDIA_BUCKET, path);
              if (publicUrl && url === publicUrl) {
                setError(true);
                return;
              }

              // If we already retried once for this path, stop.
              if (retriedRef.current) {
                setError(true);
                return;
              }
              retriedRef.current = true;

              const refreshed = await resolveStorageUrl(CHAT_MEDIA_BUCKET, path, {
                allowPublicFallback: true,
                forceRefresh: true,
                allowHttp: true,
              });

              if (!refreshed || refreshed === url) {
                setError(true);
                return;
              }

              if (!mountedRef.current || activePathRef.current !== path) return;
              setUrl(refreshed);
            } catch {
              if (mountedRef.current && activePathRef.current === path) {
                setError(true);
              }
            }
          }}
        />
      </div>

      <ImageViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} url={url} />
    </>
  );
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function ImageViewerDialog({
  open,
  onOpenChange,
  url,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  url: string;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const lastOffsetRef = useRef({ x: 0, y: 0 });

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-[calc(100%-1rem)] h-[calc(100%-1rem)] max-h-none p-0 overflow-hidden bg-black border-border/30"
        aria-label="Image viewer"
      >
        <div className="relative h-full w-full">
          <div className="absolute left-0 top-0 z-10 flex w-full items-center justify-between gap-2 p-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
              <span className="font-medium">Image</span>
              <span className="opacity-75">·</span>
              <span className="opacity-75">Scroll to zoom</span>
            </div>

            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-black/40 px-3 text-sm text-white hover:bg-black/55"
                onClick={() => {
                  try {
                    window.open(url, "_blank", "noopener,noreferrer");
                  } catch {
                    // ignore
                  }
                }}
                aria-label="Open image in new tab"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                <span>Open</span>
              </button>

              <div className="inline-flex items-center gap-1 rounded-full bg-black/40 p-1 text-white">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
                  onClick={() => setScale((s) => clamp(Number((s - 0.25).toFixed(2)), 1, 4))}
                  aria-label="Zoom out"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
                  onClick={() => setScale((s) => clamp(Number((s + 0.25).toFixed(2)), 1, 4))}
                  aria-label="Zoom in"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
                  onClick={reset}
                  aria-label="Reset view"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center"
            onWheel={(event) => {
              if (scale <= 1) return;
              event.preventDefault();
              const delta = -event.deltaY;
              const next = clamp(Number((scale + delta * 0.002).toFixed(2)), 1, 4);
              setScale(next);
            }}
            onDoubleClick={() => {
              setScale((prev) => (prev === 1 ? 2 : 1));
              setOffset({ x: 0, y: 0 });
            }}
            onPointerDown={(event) => {
              if (scale <= 1) return;
              draggingRef.current = true;
              setIsDragging(true);
              lastPointRef.current = { x: event.clientX, y: event.clientY };
              lastOffsetRef.current = offset;
              (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current) return;
              const dx = event.clientX - lastPointRef.current.x;
              const dy = event.clientY - lastPointRef.current.y;
              setOffset({ x: lastOffsetRef.current.x + dx, y: lastOffsetRef.current.y + dy });
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              setIsDragging(false);
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
              setIsDragging(false);
            }}
          >
            <img
              src={url}
              alt="Attachment"
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                transformOrigin: "center",
                transition: isDragging ? "none" : "transform 120ms ease-out",
                cursor: scale > 1 ? "grab" : "zoom-in",
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
