// src/modules/swipe/SwipeSyncBanner.tsx
import React from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
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
        <MaterialIcon name="error" className="mt-0.5 text-[18px]" ariaLabel="Error" />
        <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-snug">{message}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
            <MaterialIcon name="refresh" className="text-[18px]" ariaLabel="Retry" />
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SwipeSyncBanner;
