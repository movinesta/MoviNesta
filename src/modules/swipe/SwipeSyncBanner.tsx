// src/modules/swipe/SwipeSyncBanner.tsx
import React from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SwipeSyncBannerProps {
  message: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

const SwipeSyncBanner: React.FC<SwipeSyncBannerProps> = ({ message, onRetry, isRetrying }) => {
  if (!message) {
    return null;
  }

  return (
    <div className="mx-3 mb-3 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden={true} />
        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-snug">{message}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden={true} />
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SwipeSyncBanner;
