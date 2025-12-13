import React, { useEffect, useRef, useState } from "react";

import { CHAT_MEDIA_BUCKET } from "../chatMedia";
import { getPublicStorageUrl, resolveStorageUrl } from "../storageUrls";

/**
 * Displays an image attachment stored in Supabase Storage using a signed URL.
 * Includes small caching + "retry once" behavior for expired URLs.
 */
export const ChatImage: React.FC<{ path: string }> = ({ path }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const retriedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    setUrl(null);
    setError(false);
    retriedRef.current = false;

    if (!path) {
      setError(true);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const resolved = await resolveStorageUrl(CHAT_MEDIA_BUCKET, path, { allowPublicFallback: true });
      if (cancelled) return;

      if (!resolved) {
        setError(true);
        return;
      }

      setUrl(resolved);
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
    <div className="mt-1 overflow-hidden rounded-xl border border-border bg-background/80">
      <img
        src={url}
        alt="Attachment"
        className="max-h-64 w-full object-cover"
        loading="lazy"
        onError={async () => {
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

          setUrl(refreshed);
        }}
      />
    </div>
  );
};
