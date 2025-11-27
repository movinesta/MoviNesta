import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Plus, Search as SearchIcon, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { useConversations } from "./useConversations";
import { PageHeader, PageSection } from "../../components/PageChrome";

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useConversations();
  const [query, setQuery] = useState("");

  const queryClient = useQueryClient();

  // Realtime: refresh conversations list whenever a new message is inserted
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

  const conversations = useMemo(
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

  const handleNewConversation = () => {
    // For now, route into the Search page with people tab so the user can pick someone.
    navigate("/search?tab=people&from=messages");
  };

  return (
    <div className="relative flex flex-1 flex-col gap-4 overflow-hidden bg-gradient-to-b from-mn-bg to-mn-bg/60 px-3 pb-6 pt-3 sm:px-6 lg:px-10">
      <div className="absolute inset-x-6 top-0 h-32 rounded-3xl bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/5 to-blue-500/10 blur-3xl" aria-hidden="true" />

      <PageHeader
        title="Direct Messages"
        description="Catch up with friends and keep the conversation flowing—just like your favorite DMs."
        icon={MessageCircle}
        actions={
          <button
            type="button"
            onClick={handleNewConversation}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-mn-primary to-blue-500 px-4 py-2 text-[12px] font-semibold text-white shadow-lg shadow-mn-primary/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>New message</span>
          </button>
        }
      />

      <PageSection>
        <div className="flex flex-col gap-4 rounded-3xl border border-mn-border-subtle/80 bg-mn-bg/80 p-4 shadow-mn-card backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 space-y-2">
              <label className="sr-only" htmlFor="messages-search">
                Search conversations
              </label>
              <div className="flex items-center gap-3 rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-2 text-[12px] text-mn-text-secondary shadow-mn-soft">
                <SearchIcon className="h-4 w-4 text-mn-text-muted" aria-hidden="true" />
                <input
                  id="messages-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className="h-6 flex-1 border-none bg-transparent text-[13px] font-medium text-mn-text-primary outline-none placeholder:text-mn-text-muted"
                />
                {trimmedQuery && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="rounded-full bg-mn-bg/90 px-2 py-1 text-[11px] font-semibold text-mn-text-secondary transition hover:text-mn-text-primary"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-mn-text-muted">
                Threads feel like Instagram: bright avatars, bold names, and subtle blue unread dots.
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl bg-gradient-to-r from-fuchsia-500/10 via-mn-primary/10 to-blue-500/10 px-4 py-3 text-[11px] text-mn-text-secondary ring-1 ring-mn-border-subtle/70 shadow-mn-soft sm:max-w-xs">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-mn-text-primary">
                <Users className="h-4 w-4 text-mn-primary" aria-hidden="true" />
                <span>Start a group</span>
              </div>
              <p className="leading-tight text-mn-text-secondary">
                Create a DM with a few friends and plan your next movie night together.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-mn-border-subtle/70 bg-mn-bg/90 px-4 py-3 text-[12px] text-mn-text-secondary shadow-inner">
            <div className="flex -space-x-2">
              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 via-mn-primary to-blue-500 text-[11px] font-semibold text-white ring-2 ring-mn-bg" />
              <span className="h-8 w-8 rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-text-primary ring-2 ring-mn-bg" />
              <span className="h-8 w-8 rounded-full bg-mn-bg-elevated/70 text-[11px] font-semibold text-mn-text-primary ring-2 ring-mn-bg" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[12px] font-semibold text-mn-text-primary">You are all caught up</p>
              <p className="text-[11px] text-mn-text-muted">Swipe into any conversation to keep chatting.</p>
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection padded={false}>
        <div
          aria-live="polite"
          className="rounded-3xl border border-mn-border-subtle/80 bg-mn-bg/90 shadow-mn-card backdrop-blur"
        >
          {isLoading && (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-[12px] text-mn-text-secondary">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mn-primary/10 text-mn-primary">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
              <p className="text-[13px] font-semibold text-mn-text-primary">Loading your inbox…</p>
              <p className="text-[11px] text-mn-text-muted">Pulling the freshest DMs from your crew.</p>
            </div>
          )}

          {isError && !isLoading && (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-[12px] text-mn-text-secondary">
              <p className="text-[13px] font-semibold text-mn-text-primary">Something went wrong.</p>
              <p className="max-w-md text-[11px] text-mn-text-muted">
                {error?.message ??
                  "We could not load your messages. Please try again in a moment."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-full bg-mn-text-primary/10 px-4 py-2 text-[11px] font-semibold text-mn-text-primary transition hover:bg-mn-text-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg disabled:opacity-60"
              >
                <Loader2
                  className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : "text-mn-text-muted"}`}
                  aria-hidden="true"
                />
                <span>{isFetching ? "Retrying…" : "Reload inbox"}</span>
              </button>
            </div>
          )}

          {!isLoading && !isError && conversations.length === 0 && (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-[12px] text-mn-text-secondary">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/20 via-mn-primary/20 to-blue-500/20 text-mn-primary">
                <MessageCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-semibold text-mn-text-primary">No conversations yet</p>
              <p className="max-w-sm text-[11px] text-mn-text-muted">
                Slide into someone’s DMs to get things started. Tap <span className="font-semibold text-mn-text-primary">New message</span> to begin.
              </p>
            </div>
          )}

          {!isLoading && !isError && conversations.length > 0 && (
            <ul className="divide-y divide-mn-border-subtle/80 px-2 py-1 sm:px-3">
              {conversations.map((conv) => {
                const primaryParticipant =
                  conv.participants.find((p) => !p.isSelf) ?? conv.participants[0] ?? null;
                const avatarInitial =
                  primaryParticipant?.displayName?.[0]?.toUpperCase() ??
                  primaryParticipant?.username?.[0]?.toUpperCase() ??
                  "?";

                return (
                  <li key={conv.id} className="py-1 sm:py-1.5">
                    <Link
                      to={`/messages/${conv.id}`}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-mn-bg-elevated/70 hover:shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg ${
                        conv.hasUnread ? "bg-mn-bg/80" : ""
                      }`}
                    >
                      <div className="relative flex h-12 w-12 items-center justify-center">
                        {conv.isGroup && conv.participants.length > 1 ? (
                          <>
                            <div className="absolute left-0 top-0 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-text-primary ring-2 ring-mn-bg">
                              {conv.participants[0]?.avatarUrl ? (
                                <img
                                  src={conv.participants[0]?.avatarUrl ?? ""}
                                  alt={conv.participants[0]?.displayName ?? undefined}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                (conv.participants[0]?.displayName?.[0]?.toUpperCase() ??
                                  conv.participants[0]?.username?.[0]?.toUpperCase() ??
                                  "?")
                              )}
                            </div>
                            <div className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-text-primary ring-2 ring-mn-bg">
                              {conv.participants[1]?.avatarUrl ? (
                                <img
                                  src={conv.participants[1]?.avatarUrl ?? ""}
                                  alt={conv.participants[1]?.displayName ?? undefined}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                (conv.participants[1]?.displayName?.[0]?.toUpperCase() ??
                                  conv.participants[1]?.username?.[0]?.toUpperCase() ??
                                  "+")
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated text-[12px] font-semibold text-mn-text-primary ring-2 ring-mn-bg">
                            {primaryParticipant?.avatarUrl ? (
                              <img
                                src={primaryParticipant.avatarUrl}
                                alt={primaryParticipant.displayName ?? undefined}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              avatarInitial
                            )}
                          </div>
                        )}
                        {conv.hasUnread && (
                          <span className="absolute -right-1 -top-1 inline-flex h-3 w-3 rounded-full bg-gradient-to-br from-fuchsia-500 via-mn-primary to-blue-500 shadow-mn-soft" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={`flex-1 truncate text-[13px] ${
                              conv.hasUnread
                                ? "font-semibold text-mn-text-primary"
                                : "font-medium text-mn-text-primary"
                            }`}
                          >
                            {conv.title}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] text-mn-text-muted">
                            {conv.lastMessageAtLabel && <span>{conv.lastMessageAtLabel}</span>}
                            {conv.lastMessageIsFromSelf && conv.lastMessageSeenByOthers && !conv.hasUnread && (
                              <span className="rounded-full bg-mn-bg-elevated/80 px-2 py-0.5 text-[10px] text-mn-text-secondary">
                                Seen
                              </span>
                            )}
                          </div>
                        </div>
                        {conv.subtitle && (
                          <p className="mt-0.5 truncate text-[11px] text-mn-text-secondary">{conv.subtitle}</p>
                        )}
                        {conv.lastMessagePreview && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-mn-text-muted">{conv.lastMessagePreview}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PageSection>
    </div>
  );
};

export default MessagesPage;
