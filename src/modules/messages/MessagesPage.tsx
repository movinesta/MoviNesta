
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Plus, Search as SearchIcon, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { useConversations } from "./useConversations";

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useConversations();
  const [query, setQuery] = useState("");

  const queryClient = useQueryClient();

  // Realtime: refresh conversations list whenever a new message is inserted
  useEffect(() => {
    const channel = supabase
      .channel("supabase_realtime_messages_publication:messages-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // eslint-disable-next-line no-console
          console.log("[MessagesPage] Realtime message for list", payload);
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      );

    channel.subscribe((status) => {
      // eslint-disable-next-line no-console
      console.log("[MessagesPage] Realtime channel status (list)", status);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const trimmedQuery = query.trim().toLowerCase();

  const conversations = useMemo(
    () =>
      (data ?? []).filter((conv) => {
        if (!trimmedQuery) return true;
        const haystack = [
          conv.title,
          conv.subtitle,
          conv.lastMessagePreview ?? "",
          ...conv.participants.map((p) => p.displayName),
          ...conv.participants
            .map((p) => p.username)
            .filter((u): u is string => Boolean(u)),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(trimmedQuery);
      }),
    [data, trimmedQuery],
  );

  const handleNewConversation = () => {
    // For now, route into the Search page with people tab so the user can pick someone.
    navigate("/search?tab=people&from=messages");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
      {/* Intro banner */}
      <section className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-3 shadow-mn-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mn-text-muted">
              Messages
            </p>
            <h1 className="mt-1 text-[18px] font-heading font-semibold text-mn-text-primary sm:text-[20px]">
              Pick up the conversation.
            </h1>
            <p className="mt-1 text-[11px] text-mn-text-secondary">
              Chat with friends about what you&apos;re watching, plan movie nights, and share recommendations.
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 rounded-mn-pill border border-mn-border-subtle bg-mn-bg px-2.5 py-2 text-[11px] text-mn-text-secondary shadow-mn-soft sm:flex">
            <Users className="h-3.5 w-3.5 text-mn-primary" aria-hidden="true" />
            <span>Start a group chat to plan a watch party.</span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Search input */}
          <div className="flex-1">
            <label className="sr-only" htmlFor="messages-search">
              Search conversations
            </label>
            <div className="flex items-center gap-2 rounded-mn-pill border border-mn-border-subtle bg-mn-bg px-3 py-2 text-[12px] text-mn-text-secondary shadow-mn-soft">
              <SearchIcon className="h-3.5 w-3.5 text-mn-text-muted" aria-hidden="true" />
              <input
                id="messages-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or message…"
                className="h-6 flex-1 border-none bg-transparent text-[12px] text-mn-text-primary outline-none placeholder:text-mn-text-muted"
              />
            </div>
          </div>

          {/* New conversation button */}
          <div className="mt-1.5 flex justify-end sm:mt-0 sm:ml-3">
            <button
              type="button"
              onClick={handleNewConversation}
              className="inline-flex items-center gap-1.5 rounded-mn-pill bg-mn-primary px-3 py-2 text-[12px] font-medium text-mn-primary-foreground shadow-mn-soft transition hover:bg-mn-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>New conversation</span>
            </button>
          </div>
        </div>
      </section>

      {/* Conversation list */}
      <section aria-live="polite" className="flex-1">
        <div className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 py-1 shadow-mn-card">
          {isLoading && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-4 py-6 text-[12px] text-mn-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-mn-primary" aria-hidden="true" />
              <p>Loading your conversations…</p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-4 py-6 text-[12px] text-mn-text-secondary">
              <p className="font-medium text-mn-text-primary">Something went wrong.</p>
              <p className="text-[11px] text-mn-text-muted">
                {error?.message ?? "We couldn&apos;t load your messages. Please try again in a moment."}
              </p>
            </div>
          )}

          {!isLoading && !isError && conversations.length === 0 && (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 px-4 py-6 text-center text-[12px] text-mn-text-secondary">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mn-primary/10 text-mn-primary">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-1 text-[13px] font-medium text-mn-text-primary">
                No conversations yet.
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-mn-text-secondary">
                When you start chatting with friends, your conversations will show up here. Tap
                <span className="mx-1 rounded border border-mn-border-subtle px-1 text-[10px]">
                  New conversation
                </span>
                to get started.
              </p>
            </div>
          )}

          {!isLoading && !isError && conversations.length > 0 && (
            <ul className="divide-y divide-mn-border-subtle px-1 py-1 sm:px-2">
              {conversations.map((conv) => {
                const primaryParticipant =
                  conv.participants.find((p) => !p.isSelf) ?? conv.participants[0] ?? null;
                const avatarInitial =
                  primaryParticipant?.displayName?.[0]?.toUpperCase() ??
                  primaryParticipant?.username?.[0]?.toUpperCase() ??
                  "?";

                return (
                  <li key={conv.id} className="py-0.5 sm:py-1">
                    <Link
                      to={`/messages/${conv.id}`}
                      className="group flex items-center gap-3 rounded-mn-card border border-transparent px-3 py-2.5 transition hover:border-mn-border-subtle hover:bg-mn-bg-elevated/80 hover:shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                    >
                      {/* Avatar(s) */}
                      <div className="relative flex h-10 w-10 items-center justify-center">
                        {conv.isGroup && conv.participants.length > 1 ? (
                          <>
                            <div className="absolute left-0 top-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-primary ring-1 ring-mn-border-subtle">
                              {conv.participants[0]?.avatarUrl ? (
                                <img
                                  src={conv.participants[0]?.avatarUrl ?? ""}
                                  alt={conv.participants[0]?.displayName ?? undefined}
                                  className="h-full w-full rounded-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                conv.participants[0]?.displayName?.[0]?.toUpperCase() ??
                                conv.participants[0]?.username?.[0]?.toUpperCase() ??
                                "?"
                              )}
                            </div>
                            <div className="absolute bottom-0 right-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-primary ring-2 ring-mn-bg">
                              {conv.participants[1]?.avatarUrl ? (
                                <img
                                  src={conv.participants[1]?.avatarUrl ?? ""}
                                  alt={conv.participants[1]?.displayName ?? undefined}
                                  className="h-full w-full rounded-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                conv.participants[1]?.displayName?.[0]?.toUpperCase() ??
                                conv.participants[1]?.username?.[0]?.toUpperCase() ??
                                "+"
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-primary ring-1 ring-mn-border-subtle">
                            {primaryParticipant?.avatarUrl ? (
                              <img
                                src={primaryParticipant.avatarUrl}
                                alt={primaryParticipant.displayName ?? undefined}
                                className="h-full w-full rounded-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              avatarInitial
                            )}
                          </div>
                        )}
                      </div>

                      {/* Text content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={
                              "flex-1 truncate text-[13px] " +
                              (conv.hasUnread
                                ? "font-semibold text-mn-text-primary"
                                : "font-medium text-mn-text-primary")
                            }
                          >
                            {conv.title}
                          </p>
                          <div className="flex items-center gap-1">
                            {conv.lastMessageAtLabel && (
                              <span className="shrink-0 text-[10px] text-mn-text-muted">
                                {conv.lastMessageAtLabel}
                              </span>
                            )}
                            {conv.lastMessageIsFromSelf && conv.lastMessageSeenByOthers && !conv.hasUnread && (
                              <span className="shrink-0 text-[9px] text-mn-text-muted">Seen</span>
                            )}
                          </div>
                        </div>
                        {conv.subtitle && (
                          <p className="mt-0.5 truncate text-[11px] text-mn-text-muted">
                            {conv.subtitle}
                          </p>
                        )}

                        {conv.lastMessagePreview && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-mn-text-secondary">
                            {conv.lastMessagePreview}
                          </p>
                        )}
                      </div>

                      {/* Unread badge */}
                      <div className="ml-2 flex items-center">
                        {conv.hasUnread ? (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-mn-primary" aria-hidden="true" />
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default MessagesPage;