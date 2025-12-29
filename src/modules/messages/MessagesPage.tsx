import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useConversations, type ConversationListItem } from "./useConversations";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { MaterialIcon } from "@/components/ui/material-icon";

const ConversationListRow: React.FC<{ conversation: ConversationListItem }> = ({
  conversation,
}) => {
  const participants = conversation.participants ?? [];
  const primaryParticipant = participants.find((p) => !p.isSelf) ?? participants[0] ?? null;
  const timeLabel = conversation.lastMessageAtLabel ?? "Now";
  const isGroup = conversation.isGroup;
  const participantCount = participants.length;

  return (
    <li className="py-1">
      <Link
        to={`/messages/${conversation.id}`}
        className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
      >
        <div className="relative shrink-0">
          {isGroup && participantCount > 1 ? (
            <div className="grid h-16 w-16 grid-cols-2 gap-0.5 overflow-hidden rounded-full bg-slate-700">
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
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/50">
              {primaryParticipant?.avatarUrl ? (
                <img
                  src={primaryParticipant.avatarUrl}
                  alt={primaryParticipant.displayName ?? undefined}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                  {(primaryParticipant?.displayName ?? "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              {!isGroup && conversation.hasUnread && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background-dark bg-green-500" />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
              {conversation.title}
            </h3>
            <span className="whitespace-nowrap text-xs font-medium text-primary">
              {timeLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-sm text-slate-500 dark:text-slate-300">
              {conversation.lastMessagePreview ?? "Start chatting"}
            </p>
            {conversation.hasUnread && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </div>
        </div>
      </Link>
    </li>
  );
};

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useConversations();
  const [query, setQuery] = useState("");

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

  const storyParticipants = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl: string | null }>();

    (data ?? []).forEach((conversation) => {
      conversation.participants
        .filter((p) => !p.isSelf)
        .forEach((participant) => {
          if (!map.has(participant.id)) {
            map.set(participant.id, {
              id: participant.id,
              name: participant.displayName,
              avatarUrl: participant.avatarUrl,
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
    return <LoadingScreen />;
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-sm text-white">
        <p className="font-semibold">Unable to load messages.</p>
        <p className="mt-1 text-xs text-slate-400">
          {error?.message ?? "Please try again in a moment."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-white">
      <header className="sticky top-0 z-10 bg-background-light px-4 pb-2 pt-6 dark:bg-background-dark">
        <div className="mb-4 mt-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-900 transition-colors hover:bg-primary hover:text-white dark:bg-slate-800 dark:text-white"
            aria-label="New message"
          >
            <MaterialIcon name="edit_square" className="text-xl" ariaLabel="New message" />
          </button>
        </div>

        <div className="relative mb-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MaterialIcon name="search" className="text-slate-400" />
          </div>
          <input
            className="block w-full rounded-full border-none bg-white py-3 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary dark:bg-[#302839] dark:text-white"
            placeholder="Search friends or titles..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="-mx-4 flex space-x-4 overflow-x-auto pb-4 pl-4 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary/50">
              <MaterialIcon name="add" className="text-3xl text-primary" />
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">You</span>
          </button>

          {storyParticipants.map((participant) => (
            <button
              key={participant.id}
              type="button"
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-primary/50">
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt={participant.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-700 text-xs font-semibold">
                    {participant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="max-w-[64px] truncate text-xs font-medium text-slate-900 dark:text-white">
                {participant.name}
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-32 pt-2">
        <div className="py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Recent Chats
        </div>
        {conversations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-xs text-slate-500 dark:text-slate-300">
            <p className="font-semibold">No conversations yet.</p>
            <p className="mt-1">Start a chat with your crew.</p>
          </div>
        ) : (
          <ul>
            {conversations.map((conversation) => (
              <ConversationListRow key={conversation.id} conversation={conversation} />
            ))}
          </ul>
        )}
      </main>

      {isFetching && (
        <div className="pointer-events-none fixed bottom-24 right-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          <MaterialIcon name="sync" className="text-base" />
          Syncing…
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
