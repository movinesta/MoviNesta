import React from "react";
import { useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { FriendProfileLite } from "./useSwipeDeck";

type FriendsListModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: FriendProfileLite[];
  /** e.g. "liked" | "watched" */
  verb: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

export default function FriendsListModal({
  open,
  onOpenChange,
  profiles,
  verb,
}: FriendsListModalProps) {
  const navigate = useNavigate();
  const safe = Array.isArray(profiles) ? profiles.filter(Boolean) : [];

  const title = safe.length ? `Friends who ${verb}` : `No friends ${verb} yet`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border/60 bg-card text-foreground">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
              aria-label="Close"
              data-swipe-interactive="true"
            >
              <MaterialIcon name="close" className="text-[22px]" />
            </button>
          </div>
        </DialogHeader>

        {safe.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Once friends interact with titles, they’ll show up here.
          </p>
        ) : (
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              {safe.map((p) => {
                const display = (p.display_name ?? p.username ?? "Friend").trim() || "Friend";
                const uname = (p.username ?? "").trim();
                const fallback = initials(display);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/40 px-3 py-2.5 text-left transition hover:bg-background/70"
                    onClick={() => {
                      if (uname) {
                        onOpenChange(false);
                        navigate(`/u/${uname}`);
                      }
                    }}
                    aria-label={uname ? `Open ${display} profile` : display}
                    data-swipe-interactive="true"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-border/60 bg-muted">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={display}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-semibold text-foreground/80">
                          {fallback}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{display}</div>
                      {uname ? (
                        <div className="truncate text-xs text-muted-foreground">@{uname}</div>
                      ) : (
                        <div className="truncate text-xs text-muted-foreground">
                          Profile unavailable
                        </div>
                      )}
                    </div>

                    <div className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/60 text-muted-foreground">
                      <MaterialIcon name="chevron_right" className="text-[22px]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
