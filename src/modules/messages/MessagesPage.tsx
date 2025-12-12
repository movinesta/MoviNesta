import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, Plus, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

import { useConversations, type ConversationListItem } from "./useConversations";
import TopBar from "../../components/shared/TopBar";
import SearchField from "../../components/shared/SearchField";
import EmptyState from "../../components/shared/EmptyState";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";



type ConversationFilter = "all" | "unread" | "groups";

export const ConversationListRow: React.FC<{ conversation: ConversationListItem }> = ({
  conversation,
}) => {
  const primaryParticipant =
    conversation.participants.find((p) => !p.isSelf) ?? conversation.participants[0] ?? null;
  const avatarInitial =
    primaryParticipant?.displayName?.[0]?.toUpperCase() ??
    primaryParticipant?.username?.[0]?.toUpperCase() ??
    "?";
  const timeLabel = conversation.lastMessageAtLabel ?? "Now";
  const isGroup = conversation.isGroup;
  const participantCount = conversation.participants.length;

  const rowBase =
    "group flex items-center gap-3 rounded-2xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const rowState = conversation.hasUnread
    ? "bg-card/90 border border-primary/25 shadow-md"
    : "hover:bg-card/70 hover:-translate-y-0.5 hover:shadow-md";

  return (
    <li className="py-1 sm:py-1.5">
      <Link to={`/messages/${conversation.id}`} className={`${rowBase} ${rowState}`}>
        <div className="relative flex h-12 w-12 items-center justify-center">
          {isGroup && participantCount > 1 ? (
            <div className="flex -space-x-2">
              {conversation.participants.slice(0, 2).map((participant, idx) => (
                <span
                  key={participant.id}
                  className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-card text-xs font-semibold text-foreground ring-2 ring-background"
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
              className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold text-foreground ${
                conversation.hasUnread
                  ? "bg-gradient-to-br from-primary/80 to-amber-400 text-primary-foreground"
                  : "bg-card"
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
          {conversation.hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary shadow-md" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`truncate text-sm ${
                  conversation.hasUnread
                    ? "font-semibold text-foreground"
                    : "font-medium text-foreground"
                }`}
              >
                {conversation.title}
              </p>
              {isGroup && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <span>{participantCount} participants</span>
                </div>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeLabel}</span>
          </div>
          <p
            className={`truncate text-[12px] ${
              conversation.hasUnread ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {conversation.lastMessagePreview ?? "Start chatting"}
          </p>
        </div>
      </Link>
    </li>
  );
};

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

  const totalUnread = useMemo(() => (data ?? []).filter((conv) => conv.hasUnread).length, [data]);

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
          
<Button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition hover:-translate-y-0.5"
            aria-label="New conversation"
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      {/* Status + filters row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-1 shadow-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium">
              {totalUnread > 0 ? `${totalUnread} unread` : "Inbox is caught up"}
            </span>
          </span>
          {isFetching && !isLoading && (
            <Chip className="gap-1 px-2 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-6 overflow-hidden rounded-full bg-border/40">
                <span className="block h-full w-1/3 animate-[shimmer_1.1s_linear_infinite] bg-primary/60" />
              </span>
              Syncing…
            </Chip>
          )}
        </div>

        <div className="w-full sm:max-w-xs">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as ConversationFilter)}>
            <TabsList className="w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <SearchField
        placeholder="Search chats or people…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/* Loading state – use global loading screen */}
      {isLoading && (
        <LoadingScreen />
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
        <div className="rounded-2xl border border-border bg-background/90 shadow-lg">
          <ul className="divide-y divide-border/70 px-2 py-1 sm:px-3">
            {conversations.map((conv) => (
              <ConversationListRow key={conv.id} conversation={conv} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;