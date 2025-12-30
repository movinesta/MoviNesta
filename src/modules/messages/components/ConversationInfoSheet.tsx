import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldX, Copy as CopyIcon, BellOff, User } from "lucide-react";

import type { ConversationListItem, ConversationParticipant } from "../useConversations";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { toast } from "@/components/toasts";
import { copyToClipboard } from "@/lib/copyToClipboard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationListItem | null;
  currentUserId: string | null;
  conversationId: string;

  // Preferences
  isMuted: boolean;
  onToggleMute: () => void;

  // DM-only actions
  otherParticipant: ConversationParticipant | null;
  isGroupConversation: boolean;
  youBlocked: boolean;
  blockedYou: boolean;
  blockPending: boolean;
  onBlockToggle: () => void;
};

const ParticipantRow: React.FC<{ participant: ConversationParticipant; onClick?: () => void }> = ({
  participant,
  onClick,
}) => {
  const initial = (participant.displayName ?? participant.username ?? "?").slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-muted/60"
      disabled={!onClick}
    >
      <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
        {participant.avatarUrl ? (
          <img
            src={participant.avatarUrl}
            alt={participant.displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground/80">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{participant.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {participant.username ? `@${participant.username}` : participant.isSelf ? "You" : ""}
        </p>
      </div>
      {onClick ? <MaterialIcon name="chevron_right" className="text-muted-foreground" /> : null}
    </button>
  );
};

export const ConversationInfoSheet: React.FC<Props> = ({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  conversationId,
  isMuted,
  onToggleMute,
  otherParticipant,
  isGroupConversation,
  youBlocked,
  blockedYou,
  blockPending,
  onBlockToggle,
}) => {
  const navigate = useNavigate();

  const participants = useMemo(() => conversation?.participants ?? [], [conversation?.participants]);

  const canViewOtherProfile =
    !isGroupConversation && Boolean(otherParticipant?.username) && !otherParticipant?.isSelf;

  const mutedUntilLabel = useMemo(() => {
    const until = conversation?.mutedUntil;
    if (!isMuted || !until) return null;
    const ms = Date.parse(until);
    if (!Number.isFinite(ms) || ms <= Date.now()) return null;
    try {
      return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return null;
    }
  }, [conversation?.mutedUntil, isMuted]);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/messages/${conversationId}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.show("Conversation link copied.");
    else toast.error("Couldn't copy to clipboard.");
  };

  const handleCopyId = async () => {
    const ok = await copyToClipboard(conversationId);
    if (ok) toast.show("Conversation ID copied.");
    else toast.error("Couldn't copy to clipboard.");
  };

  const handleOpenProfile = (p: ConversationParticipant) => {
    if (!p.username) {
      toast.show("This profile can't be opened yet.");
      return;
    }
    onOpenChange(false);
    navigate(`/u/${p.username}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-auto bottom-0 translate-y-0 left-1/2 w-full max-w-3xl rounded-b-none sm:rounded-2xl sm:bottom-6 sm:rounded-b-2xl sm:translate-y-0"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-base">Conversation info</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {isGroupConversation
                ? `${participants.length} participants`
                : otherParticipant?.username
                  ? `@${otherParticipant.username}`
                  : "Direct message"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            aria-label="Close"
          >
            <MaterialIcon name="close" />
          </button>
        </div>

        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2 rounded-2xl"
            onClick={handleCopyLink}
          >
            <CopyIcon className="h-4 w-4" aria-hidden />
            Copy conversation link
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2 rounded-2xl"
            onClick={handleCopyId}
          >
            <MaterialIcon name="tag" className="text-base" ariaLabel="Conversation id" />
            Copy conversation ID
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start gap-2 rounded-2xl"
            onClick={() => {
              onToggleMute();
              onOpenChange(false);
            }}
          >
            <BellOff className="h-4 w-4" aria-hidden />
            {isMuted ? "Unmute notifications" : "Mute notifications"}
          </Button>
          {mutedUntilLabel ? (
            <p className="-mt-1 px-1 text-xs text-muted-foreground">Muted until {mutedUntilLabel}</p>
          ) : null}
        </div>

        {!isGroupConversation && (
          <div className="mt-2 grid gap-2">
            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 rounded-2xl"
              onClick={() => {
                if (!canViewOtherProfile || !otherParticipant) return;
                handleOpenProfile(otherParticipant);
              }}
              disabled={!canViewOtherProfile}
            >
              <User className="h-4 w-4" aria-hidden />
              View profile
            </Button>

            <Button
              type="button"
              variant="outline"
              className="justify-start gap-2 rounded-2xl"
              onClick={onBlockToggle}
              disabled={blockPending || (blockedYou && !youBlocked)}
            >
              <ShieldX className="h-4 w-4" aria-hidden />
              {youBlocked ? "Unblock" : blockedYou ? "Blocked" : "Block"}
            </Button>

            {(blockedYou || youBlocked) && (
              <p className="text-xs text-muted-foreground">
                {blockedYou && !youBlocked
                  ? "This user has blocked you."
                  : youBlocked
                    ? "You blocked this user."
                    : null}
              </p>
            )}
          </div>
        )}

        {isGroupConversation && (
          <div className="mt-2 rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Group admin controls (invite, leave, roles) are coming soon.
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Participants
          </div>
          <div className="grid gap-1">
            {participants.map((p) => (
              <ParticipantRow
                key={p.id}
                participant={p}
                onClick={p.username && p.id !== currentUserId ? () => handleOpenProfile(p) : undefined}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
