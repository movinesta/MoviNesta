import React from "react";
import { ArrowLeft, Info, Loader2, Phone, Users, Video } from "lucide-react";
import { HeaderSurface } from "@/components/PageChrome";
import type { ConversationListItem, ConversationParticipant } from "../useConversations";

interface ConversationHeaderProps {
  conversation: ConversationListItem | null;
  isLoading: boolean;
  isGroupConversation: boolean;
  otherParticipant?: ConversationParticipant;
  onBack: () => void;
  onToggleBlock?: () => void;
  blockPending?: boolean;
  youBlocked?: boolean;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversation,
  isLoading,
  isGroupConversation,
  otherParticipant,
  onBack,
  onToggleBlock,
  blockPending = false,
  youBlocked = false,
}) => {
  return (
    <HeaderSurface className="min-h-[3.5rem] flex-shrink-0 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-mn-text-primary shadow-mn-soft transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Back to messages</span>
        </button>

        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated ring-2 ring-mn-border-subtle">
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/25 via-mn-primary/20 to-blue-500/25"
              aria-hidden="true"
            />
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-mn-bg ring-1 ring-white/30">
              {!isGroupConversation && otherParticipant ? (
                otherParticipant.avatarUrl ? (
                  <img
                    src={otherParticipant.avatarUrl}
                    alt={otherParticipant.displayName ?? undefined}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-[13px] font-semibold text-mn-text-primary">
                    {(otherParticipant.displayName ?? "U").slice(0, 2).toUpperCase()}
                  </span>
                )
              ) : (
                <Users className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-heading font-semibold text-mn-text-primary">
              {conversation?.title ?? otherParticipant?.displayName ?? "Conversation"}
            </h1>
            <p className="truncate text-[11px] text-mn-text-secondary">
              {conversation
                ? conversation.lastMessageAtLabel
                  ? `Active ${conversation.lastMessageAtLabel}`
                  : (conversation.subtitle ??
                    (isGroupConversation
                      ? `${conversation.participants.length} participants`
                      : "Active now"))
                : isLoading
                  ? "Loading…"
                  : "Details unavailable"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-mn-text-secondary">
        {conversation && conversation.participants.length > 1 && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
            aria-label="Audio call"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {conversation && conversation.participants.length > 1 && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
            aria-label="Video call"
          >
            <Video className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {conversation && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated/70 shadow-mn-soft transition hover:-translate-y-0.5 hover:bg-mn-bg"
            aria-label="Conversation info"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {!isGroupConversation && otherParticipant && onToggleBlock && (
          <button
            type="button"
            disabled={blockPending}
            onClick={onToggleBlock}
            className="ml-1 hidden items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-mn-text-primary ring-1 ring-mn-border-subtle/70 transition hover:-translate-y-0.5 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:opacity-60 sm:inline-flex"
          >
            {blockPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            <span>{youBlocked ? "Unblock" : "Block"}</span>
          </button>
        )}
      </div>
    </HeaderSurface>
  );
};
