import React from "react";
import { ArrowDown } from "lucide-react";

interface MessageScrollToLatestProps {
  show: boolean;
  pendingCount: number;
  onClick: () => void;
  shortcutHint?: string;
}

export const MessageScrollToLatest: React.FC<MessageScrollToLatestProps> = ({
  show,
  pendingCount,
  onClick,
  shortcutHint,
}) => {
  if (!show) return null;

  const label =
    pendingCount > 1
      ? `Jump to latest message. ${pendingCount} new messages`
      : "Jump to latest message";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0)+72px)] z-20 flex justify-center px-3">
      <div className="sr-only" aria-live="polite">{pendingCount} new message{pendingCount === 1 ? "" : "s"}.</div>
      <button
        type="button"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-md backdrop-blur supports-[backdrop-filter]:backdrop-blur"
        onClick={onClick}
        aria-label={label}
        title={shortcutHint ? `${label} (${shortcutHint})` : label}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
        <span className="flex items-center gap-1">
          <span>Jump to latest</span>
          {pendingCount > 0 && (
            <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary/10 px-2 py-[2px] text-[11px] font-semibold text-primary">
              {pendingCount}
            </span>
          )}
        </span>
      </button>
    </div>
  );
};
