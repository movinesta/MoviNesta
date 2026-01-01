import React from "react";
import { Bell } from "lucide-react";

interface MessageScrollToUnreadProps {
  show: boolean;
  unreadCount: number;
  onClick: () => void;
  shortcutHint?: string;
}

export const MessageScrollToUnread: React.FC<MessageScrollToUnreadProps> = ({
  show,
  unreadCount,
  onClick,
  shortcutHint,
}) => {
  if (!show || unreadCount <= 0) return null;

  const label =
    unreadCount === 1
      ? "Jump to the first unread message"
      : `Jump to first unread message. ${unreadCount} unread messages`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top,0)+56px)] z-20 flex justify-center px-3">
      <div className="sr-only" aria-live="polite">
        {unreadCount} unread message{unreadCount === 1 ? "" : "s"}.
      </div>
      <button
        type="button"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-background/90 px-3 py-1 text-[12px] font-medium text-primary shadow-md backdrop-blur supports-[backdrop-filter]:backdrop-blur"
        onClick={onClick}
        aria-label={label}
        title={shortcutHint ? `${label} (${shortcutHint})` : label}
      >
        <Bell className="h-4 w-4" aria-hidden />
        <span className="flex items-center gap-1">
          <span>Unread</span>
          <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-primary/10 px-2 py-[2px] text-[11px] font-semibold text-primary">
            {unreadCount}
          </span>
        </span>
      </button>
    </div>
  );
};

export default MessageScrollToUnread;
