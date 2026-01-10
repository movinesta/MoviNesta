import React from "react";
import { AlertCircle, Check, CheckCheck, Copy, Edit3, Loader2, Trash2 } from "lucide-react";

import { toast } from "@/components/toasts";
import { copyToClipboard } from "@/lib/copyToClipboard";

import type { ConversationParticipant } from "../useConversations";
import {
  type ConversationMessage,
  type MessageDeliveryStatus,
  type ReactionSummary,
  formatMessageDateLabel,
  formatMessageTime,
  isSameCalendarDate,
  isWithinGroupingWindow,
} from "../messageModel";
import { getMessageMeta, getMessageType, parseMessageText } from "../messageText";

import { MessageBubble } from "./MessageBubble";
import { LinkifiedText } from "./LinkifiedText";
import { ChatImage } from "./ChatImage";
import AssistantMessageUI from "./AssistantMessageUI";
import AssistantEvidencePanel from "./AssistantEvidencePanel";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "😍"];

export interface MessageRowProps {
  message: ConversationMessage;
  meta: ReturnType<typeof getMessageMeta>;
  sender: ConversationParticipant | null;
  isSelf: boolean;
  deliveryStatus: MessageDeliveryStatus | null;
  showDeliveryStatus: boolean;
  reactions: ReactionSummary[];

  index: number;
  previousMessage: ConversationMessage | null;
  nextMessage: ConversationMessage | null;
  firstUnreadIndex: number | null;

  activeActionMessageId: string | null;
  longPressTriggeredRef: React.MutableRefObject<boolean>;

  onOpenMessageActions: (message: ConversationMessage) => void;
  onCloseMessageActions: () => void;
  onOpenEditDialog: (message: ConversationMessage, triggerEl?: HTMLElement | null) => void;
  onOpenDeleteDialog: (message: ConversationMessage) => void;

  onToggleReaction: (messageId: string, emoji: string) => void;
  onRetryMessage: (message: ConversationMessage) => void;
  onDiscardFailedMessage: (message: ConversationMessage) => void;
  onAssistantAction?: (messageId: string, actionId: string) => void | Promise<void>;

  onBubbleTouchStart: (message: ConversationMessage) => void;
  onBubbleTouchEndOrCancel: () => void;

  /** Optional in-conversation search query (used to highlight matches). */
  searchQuery?: string;
  /** Whether this message matches the current search query. */
  isSearchMatch?: boolean;
  /** Whether this message is the active search result. */
  isActiveSearchMatch?: boolean;
}

export const MessageRow = React.memo(function MessageRow({
  message,
  meta,
  sender,
  isSelf,
  deliveryStatus,
  showDeliveryStatus,
  reactions,
  index,
  previousMessage,
  nextMessage,
  firstUnreadIndex,
  activeActionMessageId,
  longPressTriggeredRef,
  onOpenMessageActions,
  onCloseMessageActions,
  onOpenEditDialog,
  onOpenDeleteDialog,
  onToggleReaction,
  onRetryMessage,
  onDiscardFailedMessage,
  onAssistantAction,
  onBubbleTouchStart,
  onBubbleTouchEndOrCancel,
  searchQuery,
  isSearchMatch,
  isActiveSearchMatch,
}: MessageRowProps) {
  const previousSameSender =
    previousMessage != null && previousMessage.senderId === message.senderId;
  const nextSameSender = nextMessage != null && nextMessage.senderId === message.senderId;

  const isCloseToPrevious =
    previousSameSender && isWithinGroupingWindow(previousMessage!.createdAt, message.createdAt);
  const isCloseToNext =
    nextSameSender && isWithinGroupingWindow(message.createdAt, nextMessage!.createdAt);

  const startsGroup = !(previousSameSender && isCloseToPrevious);
  const endsGroup = !(nextSameSender && isCloseToNext);

  const showUnreadDivider = firstUnreadIndex != null && index === firstUnreadIndex;

  const showDateDivider =
    index === 0 ||
    (previousMessage != null &&
      !isSameCalendarDate(new Date(previousMessage.createdAt), new Date(message.createdAt)));

  const stackSpacing = index === 0 || showDateDivider ? "mt-0" : startsGroup ? "mt-3" : "mt-1.5";

  const isDeletedMessage = meta.deleted === true;
  const editedAt = meta.editedAt;
  const deletedAt = meta.deletedAt;
  const name = sender?.displayName ?? (isSelf ? "You" : "Someone");
  const text = parseMessageText(message.body);

  const highlightQuery = (searchQuery ?? "").trim();
  const shouldHighlight = Boolean(highlightQuery && isSearchMatch && !isDeletedMessage);

  const messageAriaLabel = (() => {
    const senderLabel = isSelf ? "You" : name;

    if (isDeletedMessage) {
      return `${senderLabel} deleted a message`;
    }

    if (text) {
      return `${senderLabel} said: ${text}`;
    }

    if (message.attachmentUrl) {
      return `${senderLabel} sent an attachment`;
    }

    return `${senderLabel} sent a message`;
  })();

  const showAvatarAndName = !isSelf && endsGroup;

  const handleBubbleToggle = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (activeActionMessageId === message.id) {
      onCloseMessageActions();
    } else {
      onOpenMessageActions(message);
    }
  };

  return (
    <div className="px-0" key={message.id}>
      {showDateDivider && (
        <div className="my-4 flex items-center justify-center">
          <div className="inline-flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px w-12 bg-border" aria-hidden="true" />
            <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
              {formatMessageDateLabel(message.createdAt)}
            </span>
            <span className="h-px w-12 bg-border" aria-hidden="true" />
          </div>
        </div>
      )}

      {showUnreadDivider && (
        <div
          className="my-4 flex items-center justify-center"
          role="separator"
          aria-label="New messages"
        >
          <div className="inline-flex items-center gap-3 text-xs text-primary">
            <span className="h-px w-12 bg-border" aria-hidden="true" />
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              New messages
            </span>
            <span className="h-px w-12 bg-border" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Removed: "Start of new message" pill above message groups (felt noisy in chat). */}

      <div className={`flex w-full flex-col gap-0.5 ${stackSpacing}`}>
        <div className={`flex w-full items-end gap-2 ${isSelf ? "justify-end" : "justify-start"}`}>
          {!isSelf && (
            <>
              {showAvatarAndName ? (
                <div className="mt-auto h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                  {sender?.avatarUrl ? (
                    <img
                      src={sender.avatarUrl}
                      alt={sender.displayName ?? undefined}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-auto h-7 w-7 flex-shrink-0" />
              )}
            </>
          )}

          <MessageBubble
            isSelf={isSelf}
            isDeleted={isDeletedMessage}
            data-message-action-scope={message.id}
            className={
              isDeletedMessage
                ? ""
                : isActiveSearchMatch
                  ? "ring-2 ring-primary/60"
                  : isSearchMatch
                    ? "ring-2 ring-primary/25"
                    : ""
            }
            onClick={handleBubbleToggle}
            onContextMenu={(event) => {
              event.preventDefault();
              handleBubbleToggle();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleBubbleToggle();
              }
            }}
            onTouchStart={() => onBubbleTouchStart(message)}
            onTouchEnd={onBubbleTouchEndOrCancel}
            onTouchCancel={onBubbleTouchEndOrCancel}
            aria-label={messageAriaLabel}
          >
            {text && (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-snug">
                <LinkifiedText
                  text={text}
                  highlight={shouldHighlight ? highlightQuery : undefined}
                />
              </p>
            )}

            {!isDeletedMessage && message.attachmentUrl && (
              <ChatImage path={message.attachmentUrl} />
            )}
          </MessageBubble>
        </div>

        {reactions.length > 0 && (
          <div
            className={`mt-0.5 flex w-full ${isSelf ? "justify-end pr-6" : "justify-start pl-6"}`}
          >
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-foreground">
              {reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => onToggleReaction(message.id, reaction.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-background ${
                    reaction.reactedBySelf ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="text-[17px]">{reaction.emoji}</span>
                  {reaction.count > 1 && (
                    <span className="text-xs text-muted-foreground">{reaction.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeActionMessageId === message.id && !isDeletedMessage && (
          <div className={`mt-1 flex w-full ${isSelf ? "justify-end pr-6" : "justify-start pl-6"}`}>
            <div
              className="inline-flex flex-col items-stretch gap-1 rounded-2xl bg-muted px-2.5 py-1.5 text-xs text-foreground select-none"
              data-message-action-scope={message.id}
            >
              <div className="flex items-center justify-center gap-1">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onToggleReaction(message.id, emoji);
                      onCloseMessageActions();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-background"
                  >
                    <span className="text-[17px]">{emoji}</span>
                  </button>
                ))}
              </div>

              <div
                className={`mt-1 flex flex-wrap items-center gap-2 ${
                  isSelf ? "justify-end" : "justify-start"
                }`}
              >
                {text ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(text);
                      if (ok) toast.show("Copied to clipboard.");
                      else toast.error("Couldn't copy to clipboard.");
                      onCloseMessageActions();
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-background"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    <span>Copy</span>
                  </button>
                ) : null}

                {isSelf
                  ? (() => {
                      if (message.attachmentUrl || isDeletedMessage) return null;

                      // Only allow editing for plain text bodies.
                      // If body is JSON with a non-text type, disable edit to avoid clobbering
                      // structured payloads (e.g., images, system messages).
                      const bodyType = getMessageType(message.body);
                      if (bodyType !== "text" && bodyType !== "unknown") return null;

                      return (
                        <button
                          type="button"
                          onClick={(event) => onOpenEditDialog(message, event.currentTarget)}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-background"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden />
                          <span>Edit</span>
                        </button>
                      );
                    })()
                  : null}

                {isSelf ? (
                  <button
                    type="button"
                    onClick={() => onOpenDeleteDialog(message)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span>Delete</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {!isSelf && ((message as any)?.meta?.ai?.ui || (message as any)?.meta?.ai?.actions) ? (
          <div className="pl-7 pr-1">
            <AssistantMessageUI
              ui={(message as any).meta.ai.ui}
              actions={(message as any).meta.ai.actions}
              onAction={async (actionId) => {
                if (!onAssistantAction) return;
                await onAssistantAction(message.id, actionId);
              }}
            />
          </div>
        ) : null}

        {!isSelf &&
        Array.isArray((message as any)?.meta?.ai?.toolHandles) &&
        (message as any).meta.ai.toolHandles.length > 0 ? (
          <div className="pl-7 pr-1">
            <AssistantEvidencePanel handles={(message as any).meta.ai.toolHandles} />
          </div>
        ) : null}

        {showDeliveryStatus && deliveryStatus && (
          <div
            className={`flex items-center gap-1 text-xs text-muted-foreground ${
              isSelf ? "justify-end pr-1" : "justify-start pl-7"
            }`}
          >
            {deliveryStatus.status === "failed" ? (
              <>
                <AlertCircle className="h-3 w-3 text-destructive" aria-hidden />
                <span>Failed to send.</span>
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => onRetryMessage(message)}
                >
                  Retry
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => onDiscardFailedMessage(message)}
                >
                  Discard
                </button>
              </>
            ) : deliveryStatus.status === "sending" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                <span>Sending…</span>
              </>
            ) : deliveryStatus.status === "sent" ? (
              <>
                <Check className="h-3 w-3" aria-hidden />
                <span>Sent</span>
              </>
            ) : deliveryStatus.status === "delivered" ? (
              <>
                <CheckCheck className="h-3 w-3" aria-hidden />
                <span>Delivered</span>
              </>
            ) : (
              <>
                <CheckCheck className="h-3 w-3" aria-hidden />
                <span>
                  {deliveryStatus.seenAt
                    ? `Seen ${formatMessageTime(deliveryStatus.seenAt)}`
                    : "Seen"}
                </span>
              </>
            )}
          </div>
        )}

        {isDeletedMessage && deletedAt && (
          <p
            className={`text-xs text-muted-foreground ${
              isSelf ? "text-right pr-1" : "text-left pl-7"
            }`}
          >
            Deleted {formatMessageTime(deletedAt)}
          </p>
        )}

        {!isDeletedMessage && editedAt && (
          <p
            className={`text-xs text-muted-foreground ${
              isSelf ? "text-right pr-1" : "text-left pl-7"
            }`}
          >
            Edited {formatMessageTime(editedAt)}
          </p>
        )}
      </div>
    </div>
  );
});
