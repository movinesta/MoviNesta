import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MaterialIcon } from "@/components/ui/material-icon";
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

  const { data: suggestedPeople = [] } = useSuggestedPeople();
  const { data: searchResults = [] } = useSearchPeople(query.trim());

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
            : "Online",
      })),
    [suggestedPeople],
  );

  const allContacts: ContactRow[] = useMemo(() => {
    if (!query.trim()) {
      return suggestedPeople.map((person) => ({
        id: person.id,
        displayName: person.displayName ?? person.username ?? "Unknown",
        subtitle: person.username ? `@${person.username}` : null,
        avatarUrl: person.avatarUrl,
        matchLabel:
          typeof person.matchPercent === "number" && person.matchPercent > 0
            ? `${person.matchPercent}% Match`
            : "Available",
      }));
    }

    return searchResults.map((person) => ({
      id: person.id,
      displayName: person.displayName ?? person.username ?? "Unknown",
      subtitle: person.username ? `@${person.username}` : null,
      avatarUrl: person.avatarUrl,
      matchLabel:
        typeof person.matchPercent === "number" && person.matchPercent > 0
          ? `${person.matchPercent}% Match`
          : null,
    }));
  }, [query, searchResults, suggestedPeople]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleStartChat = async () => {
    if (!user?.id) {
      alert("You need to be signed in to start a conversation.");
      return;
    }

    if (selectedIds.length === 0) {
      alert("Pick someone to start a chat.");
      return;
    }

    if (selectedIds.length > 1) {
      alert("Group chats are coming soon. Please select one person for now.");
      return;
    }

    const targetUserId = selectedIds[0];

    if (user.id === targetUserId) {
      alert("You can't start a conversation with yourself.");
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
      alert(
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border shadow-2xl shadow-black/10">
        <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/90 p-4 pb-2 backdrop-blur-md">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Close"
          >
            <MaterialIcon name="close" className="text-[24px]" />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold">New Message</h2>
          <button
            type="button"
            onClick={handleStartChat}
            className="flex items-center justify-center rounded-full bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isStarting}
          >
            {isStarting ? "Starting" : "Chat"}
          </button>
        </div>

        <div className="bg-background px-4 py-3">
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
                className="h-full w-full rounded-xl rounded-l-none border-none bg-transparent px-4 pl-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder="Search friends or username"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
        </div>

        <div className="pt-4">
          <button
            type="button"
            disabled
            className="group/item flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
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

        <div className="px-4 pb-2 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Suggested
          </h3>
        </div>
        <div className="flex flex-col">
          {suggestedContacts.map((person) => {
            const inputId = `new-message-suggested-${person.id}`;
            return (
              <label
                key={person.id}
                htmlFor={inputId}
                aria-label={`Select ${person.displayName}`}
                className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-b border-border/60 px-4 py-3 transition-colors hover:bg-muted/60"
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
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
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

        <div className="px-4 pb-2 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            All Contacts
          </h3>
        </div>
        <div className="flex flex-col pb-20">
          {allContacts.map((person) => {
            const inputId = `new-message-contact-${person.id}`;
            return (
              <label
                key={person.id}
                htmlFor={inputId}
                aria-label={`Select ${person.displayName}`}
                className="flex min-h-16 cursor-pointer items-center justify-between gap-4 border-b border-border/60 px-4 py-3 transition-colors hover:bg-muted/60"
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
      </div>
    </div>
  );
};

export default NewMessagePage;
