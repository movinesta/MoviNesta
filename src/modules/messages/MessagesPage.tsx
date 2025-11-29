import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Plus, Sparkles, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { useConversations } from "./useConversations";
import TopBar from "../../components/shared/TopBar";
import SearchField from "../../components/shared/SearchField";
import EmptyState from "../../components/shared/EmptyState";

/**
 * Animated inbox loading card (matches Swipe loading vibe).
 */
const InboxLoadingCard: React.FC = () => {
  const [offset, setOffset] = useState(0);
  const directionRef = useRef<1 | -1>(1);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      directionRef.current = (directionRef.current === 1 ? -1 : 1) as 1 | -1;
      const nextOffset = directionRef.current * 14; // px
      setOffset(nextOffset);
    }, 850);

    return () => window.clearInterval(interval);
  }, []);

  const rotation = offset / 5;

  return (
    <div className="relative flex w-full max-w-md items-center justify-center">
      {/* Blurry “background” card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mx-auto flex h-[72%] max-h-[480px] w-full items-center justify-center rounded-[30px]"
        style={{
          transform: "translateY(-40px) scale(0.9)",
          opacity: 1,
          transition: "transform 280ms ease-out, opacity 280ms ease-out",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[30px] border border-mn-border-subtle/40 shadow-mn-card">
          <div className="h-full w-full bg-gradient-to-br from-mn-bg via-mn-bg-elevated to-mn-bg blur-[4px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-mn-bg/0 via-mn-bg/30 to-mn-bg/90" />
        </div>
      </div>

      {/* Main animated card */}
      <article
        className="relative z-10 mx-auto flex h-[72%] max-h-[480px] w-full select-none flex-col overflow-hidden rounded-[30px] border border-mn-border-subtle/70 bg-gradient-to-br from-mn-bg-elevated/95 via-mn-bg/95 to-mn-bg-elevated/90 shadow-mn-card backdrop-blur"
        style={{
          transform: `translateX(${offset}px) rotate(${rotation}deg)`,
          transition: "transform 480ms cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        <div className="relative h-[58%] overflow-hidden bg-gradient-to-br from-mn-bg/90 via-mn-bg/85 to-mn-bg/95">
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-mn-border-subtle/40 via-mn-border-subtle/20 to-mn-border-subtle/50" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-mn-bg/85" />
          <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 font-semibold text-mn-text-muted shadow-mn-soft">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mn-border-subtle" />
              Loading your inbox…
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg/80 px-2 py-1 text-[10px] text-mn-text-muted shadow-mn-soft">
              <Sparkles className="h-3 w-3" />
              Checking for new chats
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between bg-gradient-to-b from-mn-bg/92 via-mn-bg/96 to-mn-bg px-4 pb-4 pt-3 backdrop-blur-md">
          <div className="space-y-3 text-left text-[12px] leading-relaxed">
            <div className="space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-mn-border-subtle/60" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-mn-border-subtle/40" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded-full bg-mn-border-subtle/40" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-mn-border-subtle/30" />
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-mn-border-subtle/35" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-mn-border-subtle/25" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-surface-elevated/80 px-2 py-1 shadow-mn-soft">
              <MessageCircle className="h-4 w-4 text-mn-border-subtle" />
              Syncing conversations…
            </span>
          </div>
        </div>
      </article>
    </div>
  );
};

type ConversationFilter = "all" | "unread" | "groups";

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useConversations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConversationFilter>("all");

  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel("supabase_realtime_messages_publication:messages-list").on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload) => {
        console.log("[MessagesPage] Realtime message for list", payload);
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      },
    );

    channel.subscribe((status) => {
      console.log("[MessagesPage] Realtime channel status (list)", status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const trimmedQuery = query.trim().toLowerCase();
  const hasQuery = trimmedQuery.length > 0;

  const totalUnread = useMemo(
    () => (data ?? []).filter((conv) => conv.hasUnread).length,
    [data],
  );

  const conversations = useMemo(
    () =>
      (data ?? [])
        // filter by type
        .filter((conv) => {
          if (filter === "unread") return conv.hasUnread;
          if (filter === "groups") return conv.isGroup;
          return true; // all
        })
        // filter by search query
        .filter((conv) => {
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
    [data, trimmedQuery, filter],
  );

  const handleNewConversation = () => {
    navigate("/search?tab=people&from=messages");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar
        title="Messages"
        subtitle="Chat with friends, plan movie nights"
        actions={
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-mn-primary text-mn-bg shadow-mn-soft transition hover:-translate-y-0.5"
            aria-label="New conversation"
          >
            <Plus className="h-5 w-5" />
          </button>
        }
      />

      {/* Status + filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-mn-text-secondary">
          <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/80 px-2 py-1 shadow-mn-soft">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium">
              {totalUnread > 0 ? `${totalUnread} unread` : "Inbox is caught up"}
            </span>
          </span>
          {isFetching && !isLoading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/60 px-2 py-1 text-[10px] text-mn-text-muted">
              <span className="h-1.5 w-6 overflow-hidden rounded-full bg-mn-border-subtle/40">
                <span className="block h-full w-1/3 animate-[shimmer_1.1s_linear_infinite] bg-mn-primary/60" />
              </span>
              Syncing…
            </span>
          )}
        </div>

        <div className="flex max-w-full items-center overflow-x-auto rounded-full bg-mn-bg-elevated/60 p-1 text-[11px] shadow-mn-soft scrollbar-none">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
              filter === "all"
                ? "bg-mn-primary text-mn-bg"
                : "text-mn-text-secondary hover:text-mn-text-primary"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
              filter === "unread"
                ? "bg-mn-primary text-mn-bg"
                : "text-mn-text-secondary hover:text-mn-text-primary"
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setFilter("groups")}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 transition ${
              filter === "groups"
                ? "bg-mn-primary text-mn-bg"
                : "text-mn-text-secondary hover:text-mn-text-primary"
            }`}
          >
            Groups
          </button>
        </div>
      </div>

      <SearchField
        placeholder="Search chats or people…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-mn-border-subtle/80 bg-mn-bg/80 p-4 text-[12px] text-mn-text-secondary shadow-mn-card">
          <InboxLoadingCard />
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<MessageCircle className="h-5 w-5" />}
            title="Something went wrong"
            subtitle={error?.message ?? "Please try again in a moment."}
            actionLabel={isFetching ? "Retrying…" : "Reload inbox"}
            onAction={() => refetch()}
          />
        </div>
      )}

      {/* No results for search */}
      {!isLoading && !isError && hasQuery && conversations.length === 0 && (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="No conversations match"
          subtitle="Try a different name or clear your search to see all chats."
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      )}

      {/* No conversations at all */}
      {!isLoading && !isError && !hasQuery && conversations.length === 0 && (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Plan together"
          subtitle="Create a group chat to line up your next movie night."
          actionLabel="New conversation"
          onAction={handleNewConversation}
        />
      )}

      {/* Conversation list */}
      {!isLoading && !isError && conversations.length > 0 && (
        <div className="rounded-2xl border border-mn-border-subtle/80 bg-mn-bg/90 shadow-mn-card">
          <ul className="divide-y divide-mn-border-subtle/70 px-2 py-1 sm:px-3">
            {conversations.map((conv) => {
              const primaryParticipant =
                conv.participants.find((p) => !p.isSelf) ?? conv.participants[0] ?? null;
              const avatarInitial =
                primaryParticipant?.displayName?.[0]?.toUpperCase() ??
                primaryParticipant?.username?.[0]?.toUpperCase() ??
                "?";
              const timeLabel = conv.lastMessageAtLabel ?? "Now";
              const isGroup = conv.isGroup;
              const participantCount = conv.participants.length;

              const rowBase =
                "group flex items-center gap-3 rounded-2xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg";
              const rowState = conv.hasUnread
                ? "bg-mn-bg-elevated/90 border border-mn-primary/25 shadow-mn-soft"
                : "hover:bg-mn-bg-elevated/70 hover:-translate-y-0.5 hover:shadow-mn-soft";

              return (
                <li key={conv.id} className="py-1 sm:py-1.5">
                  <Link to={`/messages/${conv.id}`} className={`${rowBase} ${rowState}`}>
                    <div className="relative flex h-12 w-12 items-center justify-center">
                      {isGroup && participantCount > 1 ? (
                        <div className="flex -space-x-2">
                          {conv.participants.slice(0, 2).map((participant, idx) => (
                            <span
                              key={participant.id}
                              className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-text-primary ring-2 ring-mn-bg"
                              style={{ zIndex: 2 - idx }}
                            >
                              {participant.avatarUrl ? (
                                <img
                                  src={participant.avatarUrl ?? ""}
                                  alt={participant.displayName ?? undefined}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                (participant.displayName?.[0]?.toUpperCase() ??
                                  participant.username?.[0]?.toUpperCase() ??
                                  "?")
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold text-mn-text-primary ${
                            conv.hasUnread
                              ? "bg-gradient-to-br from-mn-primary/80 to-amber-400 text-mn-bg"
                              : "bg-mn-bg-elevated"
                          }`}
                        >
                          {primaryParticipant?.avatarUrl ? (
                            <img
                              src={primaryParticipant.avatarUrl ?? ""}
                              alt={primaryParticipant.displayName ?? undefined}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            avatarInitial
                          )}
                        </span>
                      )}
                      {conv.hasUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-mn-primary shadow-mn-soft" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className={`truncate text-[13px] ${
                              conv.hasUnread
                                ? "font-semibold text-mn-text-primary"
                                : "font-medium text-mn-text-primary"
                            }`}
                          >
                            {conv.title}
                          </p>
                          {isGroup && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-mn-text-muted">
                              <Users className="h-3 w-3" aria-hidden="true" />
                              <span>{participantCount} participants</span>
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-mn-text-muted">
                          {timeLabel}
                        </span>
                      </div>
                      <p
                        className={`truncate text-[12px] ${
                          conv.hasUnread ? "text-mn-text-primary" : "text-mn-text-secondary"
                        }`}
                      >
                        {conv.lastMessagePreview ?? "Start chatting"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
