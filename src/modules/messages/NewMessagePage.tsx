import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MaterialIcon } from "@/components/ui/material-icon";
import { toast } from "@/components/toasts";
import { useAuth } from "../auth/AuthProvider";
import { useSearchPeople } from "../search/useSearchPeople";
import { useSuggestedPeople } from "../profile/useSuggestedPeople";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  code?: string;
}

type ContactRow = {
  id: string;
  displayName: string;
  subtitle?: string | null;
  avatarUrl: string | null;
  matchLabel?: string | null;
};

const NewMessagePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.replace(/^@+/, "");

  const {
    data: suggestedPeople = [],
    isLoading: isSuggestedLoading,
    isError: isSuggestedError,
  } = useSuggestedPeople();

  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    isFetching: isSearchFetching,
  } = useSearchPeople(trimmedQuery);

  const suggestedContacts: ContactRow[] = useMemo(
    () =>
      suggestedPeople.slice(0, 5).map((person) => ({
        id: person.id,
        displayName: person.displayName ?? person.username ?? "Unknown",
        subtitle: person.bio,
        avatarUrl: person.avatarUrl,
        matchLabel:
          typeof person.matchPercent === "number" && person.matchPercent > 0
            ? `${person.matchPercent}% Match`
            : "Available",
      })),
    [suggestedPeople],
  );

  const suggestedIds = useMemo(
    () => new Set(suggestedContacts.map((p) => p.id)),
    [suggestedContacts],
  );

  const allContacts: ContactRow[] = useMemo(() => {
    const base = !normalizedQuery
      ? suggestedPeople.map((person) => ({
          id: person.id,
          displayName: person.displayName ?? person.username ?? "Unknown",
          subtitle: person.username ? `@${person.username}` : null,
          avatarUrl: person.avatarUrl,
          matchLabel:
            typeof person.matchPercent === "number" && person.matchPercent > 0
              ? `${person.matchPercent}% Match`
              : "Available",
        }))
      : searchResults.map((person) => ({
          id: person.id,
          displayName: person.displayName ?? person.username ?? "Unknown",
          subtitle: person.username ? `@${person.username}` : null,
          avatarUrl: person.avatarUrl,
          matchLabel:
            typeof person.matchPercent === "number" && person.matchPercent > 0
              ? `${person.matchPercent}% Match`
              : null,
        }));

    // Avoid duplicate rows between the Suggested section and All Contacts.
    return base.filter((p) => !suggestedIds.has(p.id));
  }, [normalizedQuery, searchResults, suggestedIds, suggestedPeople]);

  // Group chats are not enabled yet, so we enforce a single selection.
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? [] : [id]));
  };

  useEffect(() => {
    // Focus the search input for faster message-start flow.
    // Use a timeout to avoid competing with route transitions.
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  const selectionHint = useMemo(() => {
    if (!user?.id) return "Sign in to start a conversation.";
    if (selectedIds.length === 0) return "Select 1 person to start chatting.";
    if (selectedIds.length > 1) return "Group chats are coming soon — select only 1 person.";
    if (selectedIds[0] === user.id) return "You can't start a conversation with yourself.";
    return null;
  }, [selectedIds, user?.id]);

  const canStart =
    Boolean(user?.id) && selectedIds.length === 1 && selectedIds[0] !== user?.id && !isStarting;

  const handleStartChat = async () => {
    if (!user?.id) {
      toast.error("You need to be signed in to start a conversation.");
      return;
    }

    if (selectedIds.length === 0) {
      toast.show("Pick someone to start a chat.");
      return;
    }

    if (selectedIds.length > 1) {
      toast.show("Group chats are coming soon. Please select one person for now.");
      return;
    }

    const targetUserId = selectedIds[0];

    if (user.id === targetUserId) {
      toast.show("You can't start a conversation with yourself.");
      return;
    }

    setIsStarting(true);

    try {
      const payload = await callSupabaseFunction<CreateDirectConversationResponse>(
        "create-direct-conversation",
        { targetUserId },
        { timeoutMs: 25000 },
      );

      if (!payload?.ok || !payload.conversationId) {
        const message = payload?.error ?? "Failed to start the conversation.";
        throw new Error(message);
      }

      navigate(`/messages/${payload.conversationId}`);
    } catch (err) {
      console.error("[NewMessagePage] Failed to start conversation", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const showSearchEmpty =
    normalizedQuery.length >= 2 && !isSearchLoading && searchResults.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border shadow-2xl shadow-black/10">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/90 px-[var(--page-pad-x)] py-[var(--page-pad-y)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Close"
          >
            <MaterialIcon name="close" className="text-[24px]" />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold">New Message</h2>
          <button
            type="button"
            onClick={handleStartChat}
            className="flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-70"
            disabled={!canStart}
            aria-disabled={!canStart}
          >
            {isStarting ? "Starting" : "Chat"}
          </button>
        </div>

        <div className="bg-background page-pad py-[var(--page-pad-y)]">
          <label
            htmlFor="new-message-search"
            className="flex h-12 w-full flex-col"
            aria-label="Search contacts"
          >
            <div className="flex h-full flex-1 items-stretch rounded-xl border border-input bg-card shadow-sm">
              <div className="flex items-center justify-center rounded-l-xl px-4 text-muted-foreground">
                <MaterialIcon name="search" className="text-[24px]" />
              </div>
              <input
                id="new-message-search"
                ref={searchInputRef}
                className="h-full w-full rounded-xl rounded-l-none border-none bg-transparent px-4 pl-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search friends or username"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canStart) {
                    event.preventDefault();
                    void handleStartChat();
                  }
                }}
              />
            </div>
          </label>

          {selectionHint && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">{selectionHint}</p>
          )}

          {!selectionHint && selectedIds.length === 1 && (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Ready to chat — press <span className="font-semibold text-foreground">Chat</span>
            </p>
          )}
        </div>

        <div className="page-pad pt-4">
          <button
            type="button"
            disabled
            className="soft-row-card flex w-full items-center justify-between gap-4 row-pad min-h-11 text-left disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Create a new group (coming soon)"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
                <MaterialIcon name="group_add" className="text-[24px]" />
              </div>
              <div>
                <p className="text-base font-medium">Create a new group</p>
                <p className="text-sm text-muted-foreground">Start a watch party</p>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Coming soon
                </p>
              </div>
            </div>
            <MaterialIcon name="chevron_right" className="text-[24px] text-muted-foreground" />
          </button>
        </div>

        <div className="page-pad pb-2 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Suggested
          </h3>
        </div>
        <div className="flex flex-col">
          {isSuggestedLoading ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">Loading suggestions…</div>
          ) : isSuggestedError ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">
              Couldn&apos;t load suggestions.
            </div>
          ) : suggestedContacts.length === 0 ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">No suggestions yet.</div>
          ) : (
            <div className="page-pad flex flex-col gap-2">
              {suggestedContacts.map((person) => {
                const inputId = `new-message-suggested-${person.id}`;
                return (
                  <label
                    key={person.id}
                    htmlFor={inputId}
                    aria-label={`Select ${person.displayName}`}
                    className="soft-row-card soft-row-card-interactive flex cursor-pointer items-center justify-between gap-4 row-pad min-h-11"
                  >
                    <div className="flex flex-1 items-center gap-4 overflow-hidden">
                      <div className="relative">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-muted shadow-sm">
                          {person.avatarUrl ? (
                            <img
                              src={person.avatarUrl}
                              alt={person.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground">
                              {person.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-medium">{person.displayName}</p>
                          {person.matchLabel && (
                            <span className="text-sm font-semibold text-primary">
                              {person.matchLabel}
                            </span>
                          )}
                        </div>
                        {person.subtitle && (
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {person.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pl-4">
                      <div className="relative flex h-7 w-7 items-center justify-center">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selectedIds.includes(person.id)}
                          onChange={() => toggleSelection(person.id)}
                          className="h-6 w-6 cursor-pointer appearance-none rounded-full border-2 border-border bg-transparent checked:border-primary checked:bg-primary"
                        />
                        <MaterialIcon
                          name="check"
                          className={`absolute text-[16px] text-primary-foreground transition-opacity ${
                            selectedIds.includes(person.id) ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="page-pad pb-2 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {normalizedQuery ? "Search results" : "All Contacts"}
          </h3>
        </div>

        <div className="flex flex-col pb-20">
          {normalizedQuery && normalizedQuery.length < 2 ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </div>
          ) : normalizedQuery && (isSearchLoading || isSearchFetching) ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">Searching…</div>
          ) : showSearchEmpty ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">
              No results for{" "}
              <span className="font-semibold text-foreground">{normalizedQuery}</span>
            </div>
          ) : allContacts.length === 0 ? (
            <div className="page-pad py-4 text-sm text-muted-foreground">No contacts found.</div>
          ) : (
            <div className="page-pad flex flex-col gap-2">
              {allContacts.map((person) => {
                const inputId = `new-message-contact-${person.id}`;
                return (
                  <label
                    key={person.id}
                    htmlFor={inputId}
                    aria-label={`Select ${person.displayName}`}
                    className="soft-row-card soft-row-card-interactive flex cursor-pointer items-center justify-between gap-4 row-pad min-h-11"
                  >
                    <div className="flex flex-1 items-center gap-4 overflow-hidden">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-muted shadow-sm">
                        {person.avatarUrl ? (
                          <img
                            src={person.avatarUrl}
                            alt={person.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-foreground">
                            {person.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-base font-medium">{person.displayName}</p>
                          {person.matchLabel && (
                            <span className="text-sm font-semibold text-primary">
                              {person.matchLabel}
                            </span>
                          )}
                        </div>
                        {person.subtitle && (
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {person.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pl-4">
                      <div className="relative flex h-7 w-7 items-center justify-center">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selectedIds.includes(person.id)}
                          onChange={() => toggleSelection(person.id)}
                          className="h-6 w-6 cursor-pointer appearance-none rounded-full border-2 border-border bg-transparent checked:border-primary checked:bg-primary"
                        />
                        <MaterialIcon
                          name="check"
                          className={`absolute text-[16px] text-primary-foreground transition-opacity ${
                            selectedIds.includes(person.id) ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewMessagePage;
