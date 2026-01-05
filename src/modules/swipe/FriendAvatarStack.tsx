import React from "react";
import type { FriendProfileLite } from "./useSwipeDeck";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export default function FriendAvatarStack({
  profiles,
  max = 3,
  size = 28,
}: {
  profiles: FriendProfileLite[];
  max?: number;
  size?: number;
}) {
  const safe = Array.isArray(profiles) ? profiles.filter(Boolean) : [];
  if (!safe.length) return null;

  const shown = safe.slice(0, Math.max(1, max));
  const extra = safe.length - shown.length;

  return (
    <div className="relative flex items-center">
      <div className="flex -space-x-2">
        {shown.map((p) => {
          const label = (p.display_name ?? p.username ?? "").trim();
          const fallback = initials(label || "friend");
          return (
            <div
              key={p.id}
              className="grid place-items-center overflow-hidden rounded-full border border-background bg-muted text-[11px] font-semibold text-foreground shadow-sm"
              style={{ width: size, height: size }}
              title={label || "Friend"}
              aria-label={label || "Friend"}
            >
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt={label || "Friend avatar"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{fallback}</span>
              )}
            </div>
          );
        })}
        {extra > 0 && (
          <div
            className="grid place-items-center rounded-full border border-background bg-muted text-[11px] font-semibold text-foreground shadow-sm"
            style={{ width: size, height: size }}
            title={`${extra} more`}
            aria-label={`${extra} more`}
          >
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
