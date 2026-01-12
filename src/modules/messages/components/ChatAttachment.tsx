import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Music2 } from "lucide-react";

import { CHAT_MEDIA_BUCKET } from "../chatMedia";
import { getAttachmentKindFromPath, getAttachmentNameFromPath } from "../attachmentUtils";
import { getPublicStorageUrl, isHttpUrl, resolveStorageUrl } from "../storageUrls";
import { ChatImage } from "./ChatImage";

const useResolvedAttachmentUrl = (path: string) => {
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

  const retryIfNeeded = async () => {
    if (!mountedRef.current || activePathRef.current !== path) return;
    if (isHttpUrl(path)) {
      setError(true);
      return;
    }

    try {
      const publicUrl = getPublicStorageUrl(CHAT_MEDIA_BUCKET, path);
      if (publicUrl && url === publicUrl) {
        setError(true);
        return;
      }

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
  };

  return { url, error, retryIfNeeded };
};

const AttachmentSkeleton = () => (
  <div className="mt-1 h-12 w-48 animate-pulse rounded-xl bg-border/40" />
);

const AttachmentWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <div className="mt-1">{children}</div>;

const AttachmentAudio: React.FC<{
  url: string;
  name: string;
  onError?: () => void;
}> = ({ url, name, onError }) => (
  <AttachmentWrapper>
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-xl border border-border bg-background/80 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Music2 className="h-4 w-4" aria-hidden="true" />
        <span className="font-semibold text-foreground">{name}</span>
      </div>
      <audio
        controls
        src={url}
        className="w-full"
        onError={onError}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      >
        <track kind="captions" srcLang="en" label="Captions" />
      </audio>
    </div>
  </AttachmentWrapper>
);

const AttachmentDocument: React.FC<{ url: string; name: string }> = ({ url, name }) => (
  <AttachmentWrapper>
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-3 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-foreground hover:bg-muted/60"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/70">
        <FileText className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{name}</span>
        <span className="text-[11px] text-muted-foreground">Open document</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </a>
  </AttachmentWrapper>
);

export const ChatAttachment: React.FC<{ path: string }> = ({ path }) => {
  const kind = useMemo(() => getAttachmentKindFromPath(path), [path]);
  const { url, error, retryIfNeeded } = useResolvedAttachmentUrl(path);
  const name = useMemo(() => getAttachmentNameFromPath(path), [path]);

  if (kind === "image") {
    return <ChatImage path={path} />;
  }

  if (error) {
    return <div className="mt-1 text-xs text-muted-foreground">Attachment unavailable.</div>;
  }

  if (!url) {
    return <AttachmentSkeleton />;
  }

  if (kind === "audio") {
    return <AttachmentAudio url={url} name={name} onError={retryIfNeeded} />;
  }

  return <AttachmentDocument url={url} name={name} />;
};
