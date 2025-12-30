import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "./messageModel";
import { getMessageMeta, parseMessageText } from "./messageText";

export interface EditingMessageState {
  messageId: string;
  text: string;
  body: string | null;
  attachmentUrl: string | null;
}

export interface DeleteDialogState {
  messageId: string;
  attachmentUrl: string | null;
}

interface UseConversationMessageActionsArgs {
  conversationId: string | null;
  currentUserId: string | null;
  showComposer: boolean;
  isBlocked: boolean;
  blockedYou: boolean;
  composerTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Owns message-level action UI:
 * - reactions/action bar open/close
 * - edit dialog state + focus restore
 * - delete dialog state
 * - per-user "hide for me" persistence
 *
 * This keeps ConversationPage.tsx focused on orchestration + rendering.
 */
export const useConversationMessageActions = ({
  conversationId,
  currentUserId,
  showComposer,
  isBlocked,
  blockedYou,
  composerTextareaRef,
}: UseConversationMessageActionsArgs) => {
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Record<string, true>>({});
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  // "Hide for me" persistence: store hidden message IDs per user + conversation.
  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setHiddenMessageIds({});
      return;
    }

    if (typeof window === "undefined") return;
    const key = `messages:hidden:${currentUserId}:${conversationId}`;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        setHiddenMessageIds({});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const next: Record<string, true> = {};
        for (const id of parsed) {
          if (typeof id === "string" && id) next[id] = true;
        }
        setHiddenMessageIds(next);
        return;
      }
      if (parsed && typeof parsed === "object") {
        // Back-compat if older versions stored a record.
        const next: Record<string, true> = {};
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (value) next[id] = true;
        }
        setHiddenMessageIds(next);
        return;
      }
      setHiddenMessageIds({});
    } catch {
      setHiddenMessageIds({});
    }
  }, [conversationId, currentUserId]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;
    if (typeof window === "undefined") return;
    const key = `messages:hidden:${currentUserId}:${conversationId}`;
    try {
      const ids = Object.keys(hiddenMessageIds).filter((id) => hiddenMessageIds[id]);
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // ignore persistence errors (quota, privacy mode, etc.)
    }
  }, [conversationId, currentUserId, hiddenMessageIds]);

  const closeMessageActions = useCallback(() => {
    setActiveActionMessageId(null);
  }, []);

  // Close the actions bar when the user taps/clicks outside the active message.
  useEffect(() => {
    if (!activeActionMessageId) return;
    if (typeof document === "undefined") return;

    const handlePointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setActiveActionMessageId(null);
        return;
      }

      // Keep open when interacting with the active message bubble/actions.
      const withinActive = target.closest(
        `[data-message-action-scope="${activeActionMessageId}"]`,
      );
      if (withinActive) return;

      setActiveActionMessageId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveActionMessageId(null);
      }
    };

    // Capture ensures this runs before other click handlers (so tapping another bubble closes
    // the old actions bar before opening the new one).
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeActionMessageId]);

  const openMessageActions = useCallback(
    (message: ConversationMessage) => {
      if (isBlocked || blockedYou) return;

      const meta = getMessageMeta(message.body);
      if (meta.deleted) return; // don't open bar for deleted messages

      setActiveActionMessageId(message.id);

      // Blur main input so there's no focus border while interacting with actions
      composerTextareaRef.current?.blur();
    },
    [blockedYou, composerTextareaRef, isBlocked],
  );

  const openEditDialog = useCallback(
    (message: ConversationMessage, triggerEl?: HTMLElement | null) => {
      if (isBlocked || blockedYou) return;

      const meta = getMessageMeta(message.body);
      if (meta.deleted) return;

      if (triggerEl) {
        editTriggerRef.current = triggerEl;
      }

      setEditingMessage({
        messageId: message.id,
        text: parseMessageText(message.body) ?? "",
        body: message.body ?? null,
        attachmentUrl: message.attachmentUrl ?? null,
      });
      setEditError(null);
      closeMessageActions();
      composerTextareaRef.current?.blur();
    },
    [blockedYou, closeMessageActions, composerTextareaRef, isBlocked],
  );

  const updateEditingText = useCallback((text: string) => {
    setEditingMessage((prev) => (prev ? { ...prev, text } : prev));
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditingMessage(null);
    setEditError(null);
    editTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!editingMessage) return;
    queueMicrotask(() => {
      editTextareaRef.current?.focus();
    });
  }, [editingMessage]);

  const openDeleteDialog = useCallback(
    (message: ConversationMessage) => {
      if (isBlocked || blockedYou) return;
      closeMessageActions();
      setDeleteDialog({ messageId: message.id, attachmentUrl: message.attachmentUrl ?? null });
      composerTextareaRef.current?.blur();
    },
    [blockedYou, closeMessageActions, composerTextareaRef, isBlocked],
  );

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog(null);
  }, []);

  const hideMessageForMe = useCallback((messageId: string) => {
    setHiddenMessageIds((prev) => ({
      ...prev,
      [messageId]: true,
    }));
  }, []);

  // Restore focus to the composer when closing message actions.
  useEffect(() => {
    if (activeActionMessageId !== null) return;
    if (!showComposer) return;
    if (editingMessage || deleteDialog) return;
    queueMicrotask(() => composerTextareaRef.current?.focus());
  }, [activeActionMessageId, deleteDialog, editingMessage, showComposer, composerTextareaRef]);

  return {
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
  };
};
