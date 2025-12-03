import { AlertCircle, RotateCw } from "lucide-react";
import React from "react";

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
  if (!message) return null;

  return (
    <div className="mx-2 mb-3 rounded-lg border border-rose-400/60 bg-rose-500/10 text-rose-50 shadow-mn-card">
      <div className="flex items-start justify-between gap-3 px-3 py-2 text-[12px] leading-relaxed">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden={true} />
          <div className="space-y-0.5">
            <p className="font-semibold">We couldn't log your swipe</p>
            <p className="text-rose-50/90">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-full border border-rose-400/70 bg-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-rose-50 transition hover:bg-rose-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-1 focus-visible:ring-offset-mn-bg"
          disabled={isRetrying}
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden={true} />
          {isRetrying ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
};

export default SwipeSyncBanner;
