import React from "react";
import { useNavigate } from "react-router-dom";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
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

export default function FriendsListModal({ open, onOpenChange, profiles, verb }: FriendsListModalProps) {
  const navigate = useNavigate();
  const safe = Array.isArray(profiles) ? profiles.filter(Boolean) : [];

  const title = safe.length
    ? `Friends who ${verb}`
    : `No friends ${verb} yet`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-white/10 bg-[#140b1f] text-foreground">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base font-semibold text-white">{title}</DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="-mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              aria-label="Close"
              data-swipe-interactive="true"
            >
              <MaterialIcon name="close" className="text-[22px]" />
            </button>
          </div>
        </DialogHeader>

        {safe.length === 0 ? (
          <p className="text-sm text-white/60">Once friends interact with titles, they’ll show up here.</p>
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
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
                    onClick={() => {
                      if (uname) {
                        onOpenChange(false);
                        navigate(`/u/${uname}`);
                      }
                    }}
                    aria-label={uname ? `Open ${display} profile` : display}
                    data-swipe-interactive="true"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={display}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-xs font-semibold text-white/80">
                          {fallback}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{display}</div>
                      {uname ? (
                        <div className="truncate text-xs text-white/55">@{uname}</div>
                      ) : (
                        <div className="truncate text-xs text-white/45">Profile unavailable</div>
                      )}
                    </div>

                    <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70">
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
