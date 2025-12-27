import React, { useEffect, useRef, useState } from "react";

import { CHAT_MEDIA_BUCKET } from "../chatMedia";
import { getPublicStorageUrl, isHttpUrl, resolveStorageUrl } from "../storageUrls";

/**
 * Displays an image attachment stored in Supabase Storage using a signed URL.
 * Includes small caching + "retry once" behavior for expired URLs.
 */
export const ChatImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const activePathRef = useRef<string | null>(null);
  const retriedRef = useRef(false);

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

    // External URLs are treated as untrusted. Do not auto-load third-party images.
    if (isHttpUrl(path)) {
      setError(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const resolved = await resolveStorageUrl(CHAT_MEDIA_BUCKET, path, {
          allowPublicFallback: true,
          forceRefresh: true,
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
    if (path && isHttpUrl(path)) {
      return (
        <div className="mt-1 text-xs text-muted-foreground">
          External image link:{" "}
          <a href={path} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            open
          </a>
        </div>
      );
    }
    return <div className="mt-1 text-xs text-muted-foreground">Image unavailable.</div>;
  }

  if (!url) {
    return <div className="mt-1 h-32 w-40 animate-pulse rounded-xl bg-border/40" />;
  }

  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-border bg-background/80">
      <img
        src={url}
        alt="Attachment"
        className="max-h-64 w-full object-cover"
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
  );
};
