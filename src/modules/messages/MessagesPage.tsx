import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { useConversations } from "./useConversations";
import TopBar from "../../components/shared/TopBar";
import SearchField from "../../components/shared/SearchField";
import EmptyState from "../../components/shared/EmptyState";

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useConversations();
  const [query, setQuery] = useState("");

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
    navigate("/search?tab=people&from=messages");
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar
        title="Messages"
        subtitle="Chat with friends"
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

      <SearchField
        placeholder="Search chats or people…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {isLoading && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-mn-border-subtle/80 bg-mn-bg/80 p-6 text-[12px] text-mn-text-secondary shadow-mn-card">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your inbox…
        </div>
      )}

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

      {!isLoading && !isError && hasQuery && conversations.length === 0 && (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="No conversations match"
          subtitle="Try a different name or clear your search to see all chats."
          actionLabel="Clear search"
          onAction={() => setQuery("")}
        />
      )}

      {!isLoading && !isError && !hasQuery && conversations.length === 0 && (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Plan together"
          subtitle="Create a group chat to line up your next movie night."
          actionLabel="New conversation"
          onAction={handleNewConversation}
        />
      )}

      {!isLoading && !isError && conversations.length > 0 && (
        <div className="rounded-2xl border border-mn-border-subtle/80 bg-mn-bg/90 shadow-mn-card">
          <ul className="divide-y divide-mn-border-subtle/80 px-2 py-1 sm:px-3">
            {conversations.map((conv) => {
              const primaryParticipant =
                conv.participants.find((p) => !p.isSelf) ?? conv.participants[0] ?? null;
              const avatarInitial =
                primaryParticipant?.displayName?.[0]?.toUpperCase() ??
                primaryParticipant?.username?.[0]?.toUpperCase() ??
                "?";
              const timeLabel = conv.lastMessageAtLabel ?? "Now";

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
                        <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-mn-bg-elevated text-[12px] font-semibold text-mn-text-primary">
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
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-[13px] font-semibold text-mn-text-primary">
                          {conv.title}
                        </p>
                        <span className="ml-2 text-[11px] text-mn-text-muted">{timeLabel}</span>
                      </div>
                      <p className="truncate text-[12px] text-mn-text-secondary">
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
