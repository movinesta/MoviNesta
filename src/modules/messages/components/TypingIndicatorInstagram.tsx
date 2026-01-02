import React from "react";

import { cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";

export type TypingUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function Dot({ delayMs }: { delayMs: number }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-foreground/35 animate-bounce"
      style={{ animationDelay: `${delayMs}ms` }}
      aria-hidden="true"
    />
  );
}

/**
 * Instagram-style typing indicator: avatar + small bubble with animated dots.
 * Render it as the last row of the message list (like a temporary message).
 */
export function TypingIndicatorInstagram({
  users,
  className,
}: {
  users: TypingUser[];
  className?: string;
}) {
  if (!users.length) return null;

  const shown = users.slice(0, 3);
  const extra = Math.max(0, users.length - shown.length);

  return (
    <div
      className={cn("mt-1 flex w-full items-end gap-2 justify-start", className)}
      role="status"
      aria-live="polite"
      aria-label={users.length === 1 ? `${users[0].displayName} is typing` : "People are typing"}
    >
      <div className="relative flex items-end -space-x-2">
        {shown.map((u) => (
          <div
            key={u.id}
            className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm"
            title={u.displayName}
          >
            {u.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt={u.displayName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {initials(u.displayName)}
              </div>
            )}
          </div>
        ))}
        {extra > 0 && (
          <div className="h-7 w-7 flex-shrink-0 rounded-full border-2 border-background bg-muted shadow-sm">
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
              +{extra}
            </div>
          </div>
        )}
      </div>

      <MessageBubble
        isSelf={false}
        isDeleted={false}
        role="status"
        tabIndex={-1}
        className="pointer-events-none px-3 py-2 text-sm"
      >
        <div className="flex items-center gap-1">
          <Dot delayMs={0} />
          <Dot delayMs={120} />
          <Dot delayMs={240} />
        </div>
      </MessageBubble>
    </div>
  );
}
