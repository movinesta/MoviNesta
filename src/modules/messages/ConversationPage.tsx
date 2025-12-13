import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import type { ConversationListItem, ConversationParticipant } from "./useConversations";
import { useConversations } from "./useConversations";
import { useBlockStatus } from "./useBlockStatus";
import type { ConversationMessage } from "./messageModel";
import { useConversationMessages } from "./useConversationMessages";
import { useConversationUiMessages } from "./useConversationUiMessages";
import { useLastVisibleOwnMessageId } from "./useLastVisibleOwnMessageId";
import { useConversationReactions } from "./useConversationReactions";
import { useConversationDeliveryReceipts, useConversationReadReceipts } from "./useConversationReceipts";
import { useTypingChannel } from "./useTypingChannel";
import { useConversationDraft } from "./useConversationDraft";
import { useAttachmentUpload } from "./useAttachmentUpload";
import { useConversationLayoutState } from "./useConversationLayoutState";
import { useConversationMessageActions } from "./useConversationMessageActions";
import { useConversationReadReceiptWriter } from "./useConversationReadReceiptWriter";
import { useSendMessage } from "./useSendMessage";
import { useEditMessage } from "./useEditMessage";
import { useDeleteMessage } from "./useDeleteMessage";
import { useFailedOutgoingMessages } from "./useFailedOutgoingMessages";
import { useConversationInsertedMessageEffects } from "./useConversationInsertedMessageEffects";
import { useConversationUnreadDivider } from "./useConversationUnreadDivider";
import { ConversationHeader } from "./components/ConversationHeader";
import { MessageList } from "./components/MessageList";
import { MessageRow } from "./components/MessageRow";
import { ConversationComposerBar } from "./components/ConversationComposerBar";
import { EditMessageDialog } from "./components/EditMessageDialog";
import { DeleteMessageDialog } from "./components/DeleteMessageDialog";

// Re-export for modules that import message hooks from this file (e.g. SwipePage.tsx).
// Note: This is intentionally a named export alongside the default export.
export { useSendMessage };

const ConversationPage: React.FC = () => {
  const { conversationId: conversationIdParam } = useParams<{
    conversationId: string;
  }>();
  const conversationId = conversationIdParam ?? null;

  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: conversations, isLoading: isConversationsLoading } = useConversations();

  const handleInsertedMessage = useConversationInsertedMessageEffects({
    currentUserId: user?.id ?? null,
  });

  const {
    data: messages,
    isLoading: isMessagesLoading,
    isError: isMessagesError,
    error: messagesError,
    loadOlder,
    hasMore: hasMoreMessages,
    isLoadingOlder: isLoadingOlderMessages,
    firstItemIndex,
  } = useConversationMessages(conversationId, { onInsert: handleInsertedMessage });

  // If Postgres realtime isn't delivering change events (common when replication isn't enabled),
  // we still want delivery receipts (and inbox previews) to work when messages arrive via polling.
  // This effect runs handleInsertedMessage for messages appended since the last run.
  const lastProcessedMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId || !messages || messages.length === 0) return;

    const lastProcessedId = lastProcessedMessageIdRef.current;
    let startIndex = 0;

    if (lastProcessedId) {
      const idx = messages.findIndex((m) => m.id === lastProcessedId);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }

    for (let i = startIndex; i < messages.length; i++) {
      handleInsertedMessage(messages[i]);
    }

    lastProcessedMessageIdRef.current = messages[messages.length - 1].id;
  }, [conversationId, messages, handleInsertedMessage]);


  const { draft, setDraft } = useConversationDraft({
    conversationId,
    hydrate: () => {
      // Resize after hydration.
      queueMicrotask(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
      });
    },
  });

  const {
    sendError,
    lastFailedPayload,
    failedMessages,
    clearBannerState: clearFailedBannerState,
    onSendFailed,
    onSendRecovered,
    consumeLastFailedForRetry,
    consumeFailedMessageForRetry,
    discardFailedMessage,
  } = useFailedOutgoingMessages({
    conversationId,
    setDraft: (next) => setDraft(next),
    messages,
  });

  const conversation: ConversationListItem | null = useMemo(() => {
    if (!conversationId || !conversations) return null;
    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const isGroupConversation = conversation?.isGroup ?? false;

  const otherParticipant: ConversationParticipant | null = useMemo(() => {
    if (!conversation) return null;
    const others = conversation.participants.filter((p) => !p.isSelf);
    if (others.length > 0) return others[0];
    if (conversation.participants.length === 1) {
      return conversation.participants[0];
    }
    return null;
  }, [conversation]);

  const sendMessage = useSendMessage(conversationId, {
    onFailed: onSendFailed,
    onRecovered: onSendRecovered,
    otherUserId: !isGroupConversation ? (otherParticipant?.id ?? null) : null,
  });

  type SendAttemptPayload = {
    text: string;
    attachmentPath: string | null;
    clientId?: string;
  };

  const attemptSend = useCallback(
    (payload: SendAttemptPayload, opts?: { tempId?: string }) => {
      // Clear global error banner before re-attempting.
      clearFailedBannerState();

      sendMessage.mutate(
        {
          text: payload.text,
          attachmentPath: payload.attachmentPath,
          clientId: payload.clientId,
          tempId: opts?.tempId,
        },
        {
          onSuccess: () => {
            clearFailedBannerState();
          },
        },
      );
    },
    [clearFailedBannerState, sendMessage],
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const participantsById = useMemo(() => {
    const map = new Map<string, ConversationParticipant>();
    if (!conversation) return map;
    for (const participant of conversation.participants) {
      map.set(participant.id, participant);
    }
    return map;
  }, [conversation]);

  const {
    youBlocked,
    blockedYou,
    isBlocked,
    block,
    unblock,
  } = useBlockStatus(!isGroupConversation ? (otherParticipant?.id ?? null) : null);

  const currentUserId = user?.id ?? null;

  const {
    fileInputRef,
    isUploadingImage,
    uploadError,
    cancelImageUpload,
    clearUploadError,
    handleImageSelected,
    openFilePicker: handleCameraClick,
  } = useAttachmentUpload({
    conversationId,
    userId: currentUserId,
    isBlocked,
    blockedYou,
    attemptSend,
  });

  const showComposer = !isBlocked && !blockedYou;

  const {
    headerRef,
    headerHeight,
    composerHeight,
    isAtBottom,
    setIsAtBottom,
    handleComposerHeightChange,
    showEmojiPicker,
    setShowEmojiPicker,
  } = useConversationLayoutState({ showComposer });

  const messageListBottomPadding = showComposer
    ? `calc(${Math.max(composerHeight, 0)}px + 20px)`
    : "2.5rem";

  const selfDisplayName = useMemo(() => {
    return conversation?.participants.find((p) => p.isSelf)?.displayName ?? "You";
  }, [conversation]);

  const { remoteTypingUsers, noteLocalInputActivity, stopTyping } = useTypingChannel({
    conversationId,
    userId: user?.id ?? null,
    displayName: selfDisplayName,
  });

  const { data: readReceipts } = useConversationReadReceipts(conversationId);

  useConversationReadReceiptWriter({
    conversationId,
    userId: user?.id ?? null,
    isAtBottom,
    messages,
  });

  const { reactionsByMessageId, toggleReaction } = useConversationReactions(conversationId);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction.mutate({ messageId, emoji });
    },
    [toggleReaction],
  );
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const {
    activeActionMessageId,
    openMessageActions,
    closeMessageActions,
    hiddenMessageIds,
    hideMessageForMe,
    deleteDialog,
    openDeleteDialog,
    closeDeleteDialog,
    editingMessage,
    openEditDialog,
    updateEditingText,
    closeEditDialog,
    editTextareaRef,
    editError,
    setEditError,
  } = useConversationMessageActions({
    conversationId,
    currentUserId,
    showComposer,
    isBlocked,
    blockedYou,
    composerTextareaRef: textareaRef,
  });

  // Only show "seen" indicator on the very last *visible* outgoing message (not on every message).
  // If the user hides their most recent outgoing message "for me", we prefer showing status on the
  // last visible outgoing message instead.
  const lastOwnMessageId = useLastVisibleOwnMessageId({
    messages,
    currentUserId,
    hiddenMessageIds,
  });

  // Perf: delivery receipts can be very large in active conversations. We only need receipts
  // for the message(s) that can actually display delivery status. Today, that's the last
  // visible outgoing message.
  const { data: deliveryReceipts } = useConversationDeliveryReceipts(
    conversationId,
    lastOwnMessageId ? [lastOwnMessageId] : [],
  );

  const editMessageMutation = useEditMessage(conversationId);
  const deleteMessageMutation = useDeleteMessage(conversationId);

  const { visibleMessages } = useConversationUiMessages({
    messages,
    conversation,
    currentUserId,
    participantsById,
    reactionsByMessageId,
    hiddenMessageIds,
    deliveryReceipts,
    readReceipts,
    failedMessages,
    lastOwnMessageId,
  });

  const { firstUnreadIndex } = useConversationUnreadDivider({
    conversationId,
    userId: user?.id ?? null,
    conversation,
    readReceipts,
    visibleMessages,
  });

  const hasVisibleMessages = visibleMessages.length > 0;

  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current != null) {
        window.clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMessageActions();
      setShowEmojiPicker(false);
    };

    window.addEventListener("keydown", handleGlobalEscape);
    return () => window.removeEventListener("keydown", handleGlobalEscape);
  }, [closeMessageActions, setShowEmojiPicker]);

  const handleSendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      clearFailedBannerState();
      attemptSend({ text: text.trim(), attachmentPath: null });
    },
    [attemptSend, clearFailedBannerState],
  );

  const handleRetrySend = () => {
    const retry = consumeLastFailedForRetry();
    if (!retry) return;
    attemptSend(retry.payload, { tempId: retry.tempId ?? undefined });
  };

  // Long-tap handling: delay opening actions, and make sure click after long-press
  // does NOT instantly close the menu (fixes "appear then vanish" glitch).
  const handleBubbleTouchStart = (message: ConversationMessage) => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    longPressTriggeredRef.current = false;
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      openMessageActions(message);
    }, 500);
  };

  const handleBubbleTouchEndOrCancel = () => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  if (!conversationId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-card px-5 py-6 text-center text-sm text-foreground">
          <h1 className="text-base font-heading font-semibold">Conversation not found</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            This page is meant to be opened from your messages list.
          </p>
          <p className="mt-4">
            <Link
              to="/messages"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-foreground"
            >
              Back to messages
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const handleRetryMessage = useCallback(
    (message: ConversationMessage) => {
      const payload = consumeFailedMessageForRetry(message.id);
      if (!payload) return;
      attemptSend(payload, { tempId: message.id });
    },
    [attemptSend, consumeFailedMessageForRetry],
  );

  const handleDiscardFailedMessage = useCallback(
    (message: ConversationMessage) => {
      void discardFailedMessage(message.id);
    },
    [discardFailedMessage],
  );

  return (
    <div
      className="conversation-page relative flex min-h-screen w-full flex-col items-stretch bg-background"
      style={{ paddingTop: headerHeight }}
    >
      <div className="mx-auto flex h-full w-full max-w-3xl flex-1 min-h-0 flex-col items-stretch rounded-none border border-border bg-background sm:rounded-2xl">
        <ConversationHeader
          ref={headerRef}
          conversation={conversation}
          isLoading={isConversationsLoading}
          isGroupConversation={isGroupConversation}
          otherParticipant={otherParticipant ?? undefined}
          onBack={() => navigate("/messages")}
          onToggleBlock={
            !isGroupConversation && otherParticipant
              ? () => {
                  if (youBlocked) {
                    unblock.mutate();
                  } else if (!blockedYou) {
                    block.mutate();
                  }
                }
              : undefined
          }
          blockPending={block.isPending || unblock.isPending}
          youBlocked={youBlocked}
          blockedYou={blockedYou}
        />

        {/* Body + input */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <MessageList
              items={visibleMessages}
              isLoading={isMessagesLoading && !hasVisibleMessages}
              loadingContent={
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[12px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Loading messages…</span>
                </div>
              }
              errorContent={
                isMessagesError ? (
                  <div className="mb-3 rounded-md border border-border bg-background/90 px-3 py-2 text-[12px] text-destructive">
                    <p className="font-medium">We couldn&apos;t load this conversation.</p>
                    {messagesError instanceof Error && (
                      <p className="mt-1 text-xs text-muted-foreground">{messagesError.message}</p>
                    )}
                  </div>
                ) : undefined
              }
              emptyContent={
                !hasVisibleMessages ? (
                  <div className="text-center text-[12px] text-muted-foreground">
                    <p className="font-medium">
                      {isGroupConversation ? "No messages in this group yet." : "No messages yet."}
                    </p>
                    <p className="mt-1">
                      {isGroupConversation
                        ? "Be the first to start the conversation."
                        : "Say hi to start the conversation."}
                    </p>
                  </div>
                ) : undefined
              }
              footer={<div className="h-1" aria-hidden />}
              header={
                hasMoreMessages ? (
                  <div className="flex items-center justify-center pb-2 text-xs text-muted-foreground">
                    {isLoadingOlderMessages ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Loading older messages…
                      </span>
                    ) : (
                      <span>Scroll up to load older messages</span>
                    )}
                  </div>
                ) : null
              }
              bottomPadding={messageListBottomPadding}
              followOutput={false}
              autoScrollOnNewLastItem
              autoScrollBehavior="smooth"
              onAtBottomChange={setIsAtBottom}
              onStartReached={() => {
                if (hasMoreMessages && !isLoadingOlderMessages) {
                  void loadOlder();
                }
              }}
              firstItemIndex={firstItemIndex}
              computeItemKey={(_, item) => item.message.id}
              itemContent={(index, uiMessage) => {
                const { message, meta, sender, isSelf, deliveryStatus, reactions, showDeliveryStatus } = uiMessage;

                const previous = index > 0 ? (visibleMessages[index - 1]?.message ?? null) : null;
                const next = index < visibleMessages.length - 1 ? (visibleMessages[index + 1]?.message ?? null) : null;

                return (
                  <MessageRow
                    message={message}
                    meta={meta}
                    sender={sender}
                    isSelf={isSelf}
                    deliveryStatus={deliveryStatus}
                    showDeliveryStatus={showDeliveryStatus}
                    reactions={reactions}
                    index={index}
                    previousMessage={previous}
                    nextMessage={next}
                    firstUnreadIndex={firstUnreadIndex}
                    activeActionMessageId={activeActionMessageId}
                    longPressTriggeredRef={longPressTriggeredRef}
                    onOpenMessageActions={openMessageActions}
                    onCloseMessageActions={closeMessageActions}
                    onOpenEditDialog={openEditDialog}
                    onOpenDeleteDialog={openDeleteDialog}
                    onToggleReaction={handleToggleReaction}
                    onRetryMessage={handleRetryMessage}
                    onDiscardFailedMessage={handleDiscardFailedMessage}
                    onBubbleTouchStart={handleBubbleTouchStart}
                    onBubbleTouchEndOrCancel={handleBubbleTouchEndOrCancel}
                  />
                );
              }}
            />

          </div>

          {/* Input */}
          <ConversationComposerBar
            show={showComposer}
            headerHeight={headerHeight}
            onHeightChange={handleComposerHeightChange}
            typingUsers={remoteTypingUsers}
            isGroupConversation={isGroupConversation}
            draft={draft}
            setDraft={setDraft}
            textareaRef={textareaRef}
            noteLocalInputActivity={noteLocalInputActivity}
            stopTyping={stopTyping}
            onSendText={handleSendText}
            isUploadingImage={isUploadingImage}
            cancelImageUpload={cancelImageUpload}
            sendError={sendError}
            canRetrySend={Boolean(lastFailedPayload)}
            onRetrySend={handleRetrySend}
            uploadError={uploadError}
            clearUploadError={clearUploadError}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            openCameraPicker={handleCameraClick}
            fileInputRef={fileInputRef}
            onImageSelected={handleImageSelected}
            isSending={sendMessage.isPending}
            disableSend={Boolean(isBlocked || blockedYou)}
          />

          {blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground">
              <p>You can&apos;t send messages because this user has blocked you.</p>
            </div>
          )}

          {isBlocked && !blockedYou && (
            <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 text-center text-xs text-muted-foreground">
              <p>You&apos;ve blocked this user. Unblock them to continue the conversation.</p>
            </div>
          )}
        </section>
      </div>

      <EditMessageDialog
        open={Boolean(editingMessage)}
        editingMessage={editingMessage}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
        onCancel={closeEditDialog}
        onTextChange={updateEditingText}
        textareaRef={editTextareaRef}
        error={editError}
        isSaving={editMessageMutation.isPending}
        onSave={() => {
          if (!editingMessage) return;
          const text = editingMessage.text.trim();
          if (!text) return;

          setEditError(null);
          editMessageMutation.mutate(
            {
              messageId: editingMessage.messageId,
              text,
              currentBody: editingMessage.body,
              attachmentUrl: editingMessage.attachmentUrl,
            },
            {
              onSuccess: () => {
                closeEditDialog();
              },
              onError: () => {
                setEditError("Couldn't save changes. Please try again.");
              },
            },
          );
        }}
      />

      <DeleteMessageDialog
        open={Boolean(deleteDialog)}
        deleteDialog={deleteDialog}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        onHideForMe={() => {
          if (!deleteDialog) return;
          hideMessageForMe(deleteDialog.messageId);
          closeDeleteDialog();
        }}
        onDeleteForEveryone={() => {
          if (!deleteDialog) return;
          deleteMessageMutation.mutate(
            { messageId: deleteDialog.messageId, attachmentUrl: deleteDialog.attachmentUrl },
            {
              onSettled: () => {
                closeDeleteDialog();
              },
            },
          );
        }}
        isDeleting={deleteMessageMutation.isPending}
      />

    </div>
  );
};

export default ConversationPage;

