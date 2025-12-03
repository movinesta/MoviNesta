// src/modules/swipe/SwipeSyncBanner.tsx
import React from "react";
import { AlertCircle, RotateCw } from "lucide-react";

interface SwipeSyncBannerProps {
  message: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

const SwipeSyncBanner: React.FC<SwipeSyncBannerProps> = ({
  message,
  onRetry,
  isRetrying,
}) => {
  if (!message) {
    return null;
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden={true} />
        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-snug">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-full border border-amber-400/80 px-2 py-0.5 text-[11px] font-medium text-amber-50 transition hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg disabled:opacity-60"
            disabled={isRetrying}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden={true} />
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwipeSyncBanner;
