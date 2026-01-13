import React from "react";
import { ArrowLeft, Loader2, ShieldX, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  blockedYou?: boolean;
}

export const ConversationHeader = React.forwardRef<HTMLElement, ConversationHeaderProps>(
  (
    {
      conversation,
      isLoading,
      isGroupConversation,
      otherParticipant,
      onBack,
      onToggleBlock,
      blockPending,
      youBlocked,
      blockedYou,
    },
    ref,
  ) => {
    const title =
      conversation?.title ??
      otherParticipant?.displayName ??
      otherParticipant?.username ??
      "Conversation";
    const subtitle =
      conversation?.subtitle ??
      (isGroupConversation
        ? `${conversation?.participants?.length ?? ""} participants`
        : otherParticipant?.username
          ? `@${otherParticipant.username}`
          : "Direct message");

    const avatarUrl = isGroupConversation ? undefined : otherParticipant?.avatarUrl;
    const avatarFallback = isGroupConversation
      ? (conversation?.title?.slice(0, 2).toUpperCase() ?? "GM")
      : (otherParticipant?.displayName ?? otherParticipant?.username ?? "?")
          .slice(0, 2)
          .toUpperCase();

    return (
      <header
        ref={ref}
        className="fixed inset-x-0 top-[env(safe-area-inset-top,0)] z-50 w-full border-b border-border bg-card/90 page-pad pb-3 pt-3 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to messages" className="icon-hit text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>

          <Avatar className="h-11 w-11">
            <AvatarImage src={avatarUrl ?? undefined} alt={title} />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                  {isGroupConversation && (
                    <Badge variant="outline" className="gap-1">
                      <Users className="h-3 w-3" aria-hidden />
                      Group chat
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              </div>
            )}
          </div>

          {onToggleBlock && !isGroupConversation && (
            <Button
              type="button"
              variant={youBlocked ? "destructive" : "outline"}
              size="sm"
              className="gap-2"
              disabled={blockPending || isLoading || (blockedYou && !youBlocked)}
              onClick={onToggleBlock}
            >
              {blockPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              <ShieldX className="h-4 w-4" aria-hidden />
              {youBlocked ? "Unblock" : blockedYou ? "Blocked" : "Block"}
            </Button>
          )}
        </div>
      </header>
    );
  },
);

ConversationHeader.displayName = "ConversationHeader";
