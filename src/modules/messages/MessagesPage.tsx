import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";

import { useConversations, type ConversationListItem } from "./useConversations";
import { useAuth } from "../auth/AuthProvider";
import { usePresence } from "../presence/PresenceProvider";
import { MaterialIcon } from "@/components/ui/material-icon";
import VerifiedBadge from "@/components/VerifiedBadge";
import { toast } from "@/components/toasts";
import { supabase } from "@/lib/supabase";
import { useAssistantCache } from "@/lib/useAssistantCache";
import { usePublicSettings } from "@/providers/PublicSettingsProvider";
import { clearReadReceipt, writeReadReceipt } from "./supabaseReceiptWrites";
import { updateConversationListItemInCache } from "./conversationsCache";
import {
  migrateLocalConversationPrefsToRemoteIfNeeded,
  saveConversationPrefs,
} from "./conversationPrefs";
import { conversationsQueryKey } from "./queryKeys";
import { ConversationActionsSheet } from "./components/ConversationActionsSheet";
import { MuteOptionsSheet, type MutePreset } from "./components/MuteOptionsSheet";

const MessagesPageSkeleton: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background px-[var(--page-pad-x)] pb-2 pt-4 full-bleed">
        <div className="mb-3 mt-1.5 flex items-center justify-between">
          <div className="h-9 w-40 rounded-xl bg-muted animate-pulse" aria-hidden />
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" aria-hidden />
        </div>

        <div className="relative mb-3">
          <div className="h-12 w-full rounded-full bg-muted animate-pulse" aria-hidden />
        </div>

        <div className="-mt-1 mb-3 flex items-center gap-2">
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" aria-hidden />
          <div className="h-6 w-28 rounded-full bg-muted animate-pulse" aria-hidden />
          <div className="ml-auto h-4 w-12 rounded bg-muted animate-pulse" aria-hidden />
        </div>

        <div className="full-bleed flex space-x-4 overflow-x-auto border-b border-border/60 pb-3 pl-[var(--page-pad-x)] pr-[var(--page-pad-x)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="flex shrink-0 flex-col items-center gap-1">
              <div className="h-14 w-14 rounded-full bg-muted animate-pulse" aria-hidden />
              <div className="h-3 w-12 rounded bg-muted animate-pulse" aria-hidden />
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-[var(--page-pad-x)] pb-32 pt-2">
        <div className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Chats
        </div>
        <ul className="space-y-1">
          {Array.from({ length: 8 }).map((_, idx) => (
            <li key={idx} className="rounded-2xl p-2.5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-muted animate-pulse" aria-hidden />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div
                      className="h-4 w-44 max-w-[70%] rounded bg-muted animate-pulse"
                      aria-hidden
                    />
                    <div className="h-3 w-12 rounded bg-muted animate-pulse" aria-hidden />
                  </div>
                  <div
                    className="mt-2 h-3 w-64 max-w-[85%] rounded bg-muted animate-pulse"
                    aria-hidden
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};

const LONG_PRESS_MS = 450;

const ConversationListRow: React.FC<{
  conversation: ConversationListItem;
  isMuted: boolean;
  onOpenActions: (conversation: ConversationListItem) => void;
  dimmed?: boolean;
}> = ({ conversation, isMuted, onOpenActions, dimmed = false }) => {
  const { getStatus: getPresenceStatus } = usePresence();
  const participants = conversation.participants ?? [];
  const primaryParticipant = participants.find((p) => !p.isSelf) ?? participants[0] ?? null;
  const timeLabel = conversation.lastMessageAtLabel ?? "Now";
  const isGroup = conversation.isGroup;
  const participantCount = participants.length;

  const primaryIsOnline =
    !isGroup && primaryParticipant?.id
      ? getPresenceStatus(primaryParticipant.id) === "online"
      : false;

  const longPressRef = useRef<{
    timeoutId: number | null;
    fired: boolean;
  }>({ timeoutId: null, fired: false });

  const startLongPress = (event: React.PointerEvent) => {
    if (event.pointerType && event.pointerType !== "touch") return;
    longPressRef.current.fired = false;
    if (longPressRef.current.timeoutId != null) {
      window.clearTimeout(longPressRef.current.timeoutId);
    }
    longPressRef.current.timeoutId = window.setTimeout(() => {
      longPressRef.current.fired = true;
      onOpenActions(conversation);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    if (longPressRef.current.timeoutId != null) {
      window.clearTimeout(longPressRef.current.timeoutId);
      longPressRef.current.timeoutId = null;
    }
  };

  return (
    <li>
      <Link
        to={`/messages/${conversation.id}`}
        className={
          "soft-row-card soft-row-card-interactive group flex items-center gap-3 row-pad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background" +
          (dimmed ? " opacity-70" : "")
        }
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          cancelLongPress();
          onOpenActions(conversation);
        }}
        onClick={(e) => {
          if (longPressRef.current.fired) {
            e.preventDefault();
            e.stopPropagation();
            longPressRef.current.fired = false;
          }
        }}
      >
        <div className="relative shrink-0">
          {isGroup && participantCount > 1 ? (
            <div className="grid h-14 w-14 grid-cols-2 gap-0.5 overflow-hidden rounded-full bg-muted">
              {participants.slice(0, 4).map((participant) => (
                <div
                  key={participant.id}
                  className="h-full w-full bg-cover bg-center"
                  style={
                    participant.avatarUrl
                      ? { backgroundImage: `url(${participant.avatarUrl})` }
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-primary/50">
              {primaryParticipant?.avatarUrl ? (
                <img
                  src={primaryParticipant.avatarUrl}
                  alt={primaryParticipant.displayName ?? undefined}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
                  {(primaryParticipant?.displayName ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}

              {primaryIsOnline && (
                <span
                  className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-green-500"
                  title="Online"
                />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 truncate text-base font-bold text-foreground">
              <span className="truncate">{conversation.title}</span>
              {!isGroup && primaryParticipant?.isVerified ? (
                <VerifiedBadge
                  isVerified={primaryParticipant?.isVerified ?? null}
                  type={(primaryParticipant.verifiedType as any) ?? null}
                  label={primaryParticipant.verifiedLabel ?? null}
                  verifiedAt={primaryParticipant.verifiedAt ?? null}
                  org={primaryParticipant.verifiedByOrg ?? null}
                />
              ) : null}
            </h3>
            <span className="whitespace-nowrap text-xs font-medium text-primary">{timeLabel}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-sm text-muted-foreground">
              {primaryIsOnline && (
                <>
                  <span className="font-semibold text-green-500">Online</span>
                  <span className="mx-1">•</span>
                </>
              )}
              {conversation.lastMessagePreview ?? "Start chatting"}
            </p>
            {isMuted && (
              <MaterialIcon
                name="notifications_off"
                className="text-sm text-muted-foreground"
                ariaLabel="Muted"
              />
            )}
            {conversation.hasUnread && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </div>
        </div>

        <button
          type="button"
          className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
          aria-label="Conversation actions"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelLongPress();
            onOpenActions(conversation);
          }}
        >
          <MaterialIcon name="more_horiz" className="text-xl" ariaLabel="More" />
        </button>
      </Link>
    </li>
  );
};

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const assistantCache = useAssistantCache();

  const { getString } = usePublicSettings();
  const assistantUsernameLower = useMemo(
    () => getString("ux.assistant.username", "movinesta").toLowerCase(),
    [getString],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useConversations();
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const isAssistantConversation = useCallback(
    (conv: ConversationListItem) => {
      if (assistantCache?.conversationId && conv.id === assistantCache.conversationId) return true;

      return conv.participants.some(
        (p) => !p.isSelf && p.username?.toLowerCase() === assistantUsernameLower,
      );
    },
    [assistantCache?.conversationId, assistantUsernameLower],
  );

  const assistantConversation = useMemo(
    () => (data ?? []).find((c) => isAssistantConversation(c)) ?? null,
    [data, isAssistantConversation],
  );

  const [assistantOpening, setAssistantOpening] = useState(false);
  const openAssistantChat = useCallback(async () => {
    if (!userId) return;
    if (assistantOpening) return;

    // Dedicated assistant-only UI (it will fetch/create the assistant conversation internally).
    setAssistantOpening(true);
    try {
      navigate("/assistant");
    } finally {
      setAssistantOpening(false);
    }
  }, [assistantOpening, navigate, userId]);

  // If the user has local prefs from older builds, push them to the server once.
  React.useEffect(() => {
    migrateLocalConversationPrefsToRemoteIfNeeded(userId).then(() => {
      // Refresh list so v2 prefs can take effect.
      if (userId) queryClient.invalidateQueries({ queryKey: conversationsQueryKey(userId) });
    });
  }, [userId, queryClient]);

  const trimmedQuery = query.trim().toLowerCase();

  const conversationsByQuery = useMemo(
    () =>
      (data ?? []).filter((conv) => {
        if (!trimmedQuery) return true;
        const haystack = [
          conv.title,
          conv.subtitle,
          conv.lastMessagePreview ?? "",
          ...conv.participants.map((p) => p.displayName),
          ...conv.participants.map((p) => p.username).filter((u): u is string => Boolean(u)),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(trimmedQuery);
      }),
    [data, trimmedQuery],
  );

  const { visibleConversations, hiddenConversations } = useMemo(() => {
    const visible: ConversationListItem[] = [];
    const hidden: ConversationListItem[] = [];

    conversationsByQuery.forEach((c) => {
      if (c.isHidden) hidden.push(c);
      else visible.push(c);
    });

    const filteredVisible = visible;

    // Keep the assistant thread pinned (rendered separately), so remove it from normal lists.
    const filteredVisibleNoAssistant = filteredVisible.filter((c) => !isAssistantConversation(c));
    const hiddenNoAssistant = hidden.filter((c) => !isAssistantConversation(c));

    return {
      visibleConversations: filteredVisibleNoAssistant,
      hiddenConversations: hiddenNoAssistant,
    };
  }, [conversationsByQuery, isAssistantConversation]);

  const hiddenCount = useMemo(() => (data ?? []).filter((c) => c.isHidden).length, [data]);

  const mutedCount = useMemo(() => (data ?? []).filter((c) => c.isMuted).length, [data]);

  const showAssistantRow = useMemo(() => {
    if (trimmedQuery) return false;
    return true;
  }, [trimmedQuery]);

  const hasAnyRows = useMemo(() => {
    if (showAssistantRow) return true;
    if (visibleConversations.length > 0) return true;
    if (showHidden && hiddenConversations.length > 0) return true;
    return false;
  }, [showAssistantRow, visibleConversations.length, showHidden, hiddenConversations.length]);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsConversationId, setActionsConversationId] = useState<string | null>(null);
  const actionsConversation = useMemo(
    () =>
      actionsConversationId
        ? ((data ?? []).find((c) => c.id === actionsConversationId) ?? null)
        : null,
    [actionsConversationId, data],
  );

  const [muteOptionsOpen, setMuteOptionsOpen] = useState(false);
  const [muteConversationId, setMuteConversationId] = useState<string | null>(null);
  const muteConversation = useMemo(
    () =>
      muteConversationId ? ((data ?? []).find((c) => c.id === muteConversationId) ?? null) : null,
    [muteConversationId, data],
  );

  const openMuteOptions = (conversation: ConversationListItem) => {
    setMuteConversationId(conversation.id);
    setMuteOptionsOpen(true);
  };

  const openActions = (conversation: ConversationListItem) => {
    setActionsConversationId(conversation.id);
    setActionsOpen(true);
  };

  const toggleMute = (conversation: ConversationListItem) => {
    if (!userId) {
      toast.error("Please sign in to manage messages.");
      return;
    }

    if (conversation.isMuted) {
      const prevUntil = conversation.mutedUntil ?? null;

      // Unmute immediately (clears timed or indefinite mutes).
      updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
        ...c,
        isMuted: false,
        mutedUntil: null,
      }));

      toast.show("Unmuted notifications.");

      saveConversationPrefs(userId, conversation.id, {
        muted: false,
        hidden: conversation.isHidden,
        mutedUntil: null,
      }).then(({ ok }) => {
        if (ok) return;
        updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
          ...c,
          isMuted: true,
          mutedUntil: prevUntil,
        }));
        toast.error("Couldn't update preferences.");
      });

      return;
    }

    // Not muted: show duration picker.
    openMuteOptions(conversation);
  };

  const applyMutePreset = (conversation: ConversationListItem, preset: MutePreset) => {
    if (!userId) {
      toast.error("Please sign in to manage messages.");
      return;
    }

    const prevMuted = conversation.isMuted;
    const prevUntil = conversation.mutedUntil ?? null;

    let nextMuted = false;
    let nextUntil: string | null = null;

    if (preset.kind === "indefinite") {
      nextMuted = true;
      nextUntil = null;
    } else {
      nextMuted = false;
      nextUntil = new Date(Date.now() + preset.minutes * 60_000).toISOString();
    }

    // Optimistic UI
    updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
      ...c,
      isMuted: true,
      mutedUntil: nextUntil,
    }));

    toast.show(`Muted notifications for ${preset.label}.`);

    saveConversationPrefs(userId, conversation.id, {
      muted: nextMuted,
      hidden: conversation.isHidden,
      mutedUntil: nextUntil,
    }).then(({ ok }) => {
      if (ok) return;
      updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
        ...c,
        isMuted: prevMuted,
        mutedUntil: prevUntil,
      }));
      toast.error("Couldn't update preferences.");
    });
  };

  const toggleHidden = (conversation: ConversationListItem) => {
    if (!userId) {
      toast.error("Please sign in to manage messages.");
      return;
    }

    const nextHidden = !conversation.isHidden;
    updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
      ...c,
      isHidden: nextHidden,
    }));

    toast.show(nextHidden ? "Conversation hidden." : "Conversation restored.");

    saveConversationPrefs(userId, conversation.id, {
      muted: conversation.isMuted,
      hidden: nextHidden,
      mutedUntil: conversation.mutedUntil ?? null,
    }).then(({ ok }) => {
      if (ok) return;
      updateConversationListItemInCache(queryClient, userId, conversation.id, (c) => ({
        ...c,
        isHidden: !nextHidden,
      }));
      toast.error("Couldn't update preferences.");
    });
  };

  const markAsRead = async (conversation: ConversationListItem) => {
    if (!userId) {
      toast.error("Please sign in to manage messages.");
      return;
    }
    if (!conversation.lastMessageId) {
      toast.show("No messages to mark as read.");
      return;
    }

    // Prefer the database function (keeps server logic centralized).
    const { error: rpcError } = await supabase.rpc("mark_conversation_read", {
      p_conversation_id: conversation.id,
      p_last_message_id: conversation.lastMessageId,
    });

    if (rpcError) {
      // Fallback to direct receipt write.
      await writeReadReceipt({
        conversation_id: conversation.id,
        user_id: userId,
        last_read_message_id: conversation.lastMessageId,
        last_read_at: new Date().toISOString(),
      });
    }

    updateConversationListItemInCache(queryClient, userId, conversation.id, (current) => {
      if (!current.hasUnread) return current;
      return { ...current, hasUnread: false };
    });
  };

  const markAsUnread = async (conversation: ConversationListItem) => {
    if (!userId) {
      toast.error("Please sign in to manage messages.");
      return;
    }

    // Marking unread is a client convenience. Best effort: clear the read receipt on the server.
    const result = await clearReadReceipt(conversation.id, userId);
    if (!result.ok) {
      console.warn("[MessagesPage] Failed to clear read receipt (mark unread)", result.error);
      toast.show("Marked as unread locally. Server update may have failed.");
    }

    updateConversationListItemInCache(queryClient, userId, conversation.id, (current) => {
      if (current.hasUnread) return current;
      return { ...current, hasUnread: true };
    });
  };

  const storyParticipants = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; avatarUrl: string | null; conversationId: string }
    >();

    (data ?? []).forEach((conversation) => {
      if (conversation.isHidden) return;
      conversation.participants
        .filter((p) => !p.isSelf)
        .forEach((participant) => {
          if (!map.has(participant.id)) {
            map.set(participant.id, {
              id: participant.id,
              name: participant.displayName,
              avatarUrl: participant.avatarUrl,
              conversationId: conversation.id,
            });
          }
        });
    });

    return Array.from(map.values()).slice(0, 8);
  }, [data]);

  const handleNewConversation = () => {
    navigate("/messages/new");
  };

  if (isLoading) {
    return <MessagesPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-sm text-foreground">
        <p className="font-semibold">Unable to load messages.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {error?.message ?? "Please try again in a moment."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-background px-[var(--page-pad-x)] pb-2 pt-4 full-bleed">
        <div className="mb-3 mt-1.5 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="New message"
          >
            <MaterialIcon name="edit_square" className="text-xl" ariaLabel="New message" />
          </button>
        </div>

        <div className="relative mb-3">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MaterialIcon name="search" className="text-muted-foreground" />
          </div>
          <input
            className="block w-full rounded-full border border-input bg-card py-3 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search friends or titles..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="-mt-1 mb-3 flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className={
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition " +
                (showHidden
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted")
              }
            >
              <MaterialIcon name="visibility_off" className="text-base" ariaLabel="Hidden" />
              Hidden ({hiddenCount})
            </button>
          )}

          {mutedCount > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MaterialIcon name="notifications_off" className="text-base" ariaLabel="Muted" />
              {mutedCount}
            </span>
          )}
        </div>

        <div className="full-bleed flex space-x-4 overflow-x-auto border-b border-border/60 pb-3 pl-[var(--page-pad-x)] pr-[var(--page-pad-x)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary/50">
              <MaterialIcon name="add" className="text-3xl text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">New</span>
          </button>

          {storyParticipants.map((participant) => (
            <button
              key={participant.id}
              type="button"
              className="flex shrink-0 flex-col items-center gap-1"
              onClick={() => navigate(`/messages/${participant.conversationId}`)}
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-primary/50">
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt={participant.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-xs font-semibold text-foreground">
                    {participant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="max-w-[56px] truncate text-xs font-medium text-foreground">
                {participant.name}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-[var(--page-pad-x)] pb-32 pt-2">
        <div className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Chats
        </div>
        {!hasAnyRows ? (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-4 text-center text-xs text-muted-foreground">
            {trimmedQuery ? (
              <>
                <p className="font-semibold">No matches.</p>
                <p className="mt-1">Try a different search.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">No conversations yet.</p>
                <p className="mt-1">Start a chat with your crew.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {showAssistantRow && (
                <li>
                  <button
                    type="button"
                    onClick={openAssistantChat}
                    disabled={!userId || assistantOpening}
                    className={
                      "soft-row-card soft-row-card-interactive group flex w-full items-center gap-3 row-pad text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
                      (assistantOpening ? " opacity-70" : "")
                    }
                  >
                    <div className="relative shrink-0">
                      <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-primary/60">
                        {assistantConversation?.participants?.find((p) => !p.isSelf)?.avatarUrl ? (
                          <img
                            src={
                              assistantConversation.participants.find((p) => !p.isSelf)
                                ?.avatarUrl ?? undefined
                            }
                            alt="MoviNesta"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-foreground">
                            M
                          </div>
                        )}

                        {assistantConversation?.hasUnread ? (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-primary" />
                        ) : null}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-semibold text-foreground">
                          MoviNesta Assistant
                        </div>
                        {assistantConversation?.lastMessageAtLabel ? (
                          <div className="shrink-0 text-xs text-muted-foreground">
                            {assistantConversation.lastMessageAtLabel}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {assistantConversation?.lastMessagePreview ??
                          "Ask for recommendations, refine your taste, plan watch goals."}
                      </div>
                    </div>
                  </button>
                </li>
              )}

              {visibleConversations.map((conversation) => (
                <ConversationListRow
                  key={conversation.id}
                  conversation={conversation}
                  isMuted={conversation.isMuted}
                  onOpenActions={openActions}
                />
              ))}
            </ul>

            {showHidden && hiddenConversations.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Hidden chats
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHidden(false)}
                    className="rounded-full bg-muted/60 px-3 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Hide
                  </button>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {hiddenConversations.map((conversation) => (
                    <ConversationListRow
                      key={conversation.id}
                      conversation={conversation}
                      isMuted={conversation.isMuted}
                      onOpenActions={openActions}
                      dimmed
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>

      <ConversationActionsSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        conversation={actionsConversation}
        isMuted={Boolean(actionsConversation?.isMuted)}
        isHidden={Boolean(actionsConversation?.isHidden)}
        onOpenConversation={() => {
          if (!actionsConversationId) return;
          setActionsOpen(false);
          navigate(`/messages/${actionsConversationId}`);
        }}
        onToggleMute={() => {
          if (!actionsConversation) return;
          toggleMute(actionsConversation);
        }}
        onToggleHidden={() => {
          if (!actionsConversation) return;
          toggleHidden(actionsConversation);
        }}
        onMarkRead={() => {
          if (!actionsConversation) return;
          markAsRead(actionsConversation);
        }}
        onMarkUnread={() => {
          if (!actionsConversation) return;
          markAsUnread(actionsConversation);
        }}
      />

      <MuteOptionsSheet
        open={muteOptionsOpen}
        onOpenChange={setMuteOptionsOpen}
        conversationTitle={muteConversation?.title}
        onSelect={(preset) => {
          if (!muteConversation) return;
          applyMutePreset(muteConversation, preset);
        }}
      />

      {isFetching && (
        <div className="pointer-events-none fixed bottom-24 right-4 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-md">
          <MaterialIcon name="sync" className="text-base" />
          Syncing…
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
