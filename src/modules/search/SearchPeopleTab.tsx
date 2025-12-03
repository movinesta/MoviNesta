import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Users, UserPlus, UserMinus, MessageCircle } from "lucide-react";
import { useSearchPeople } from "./useSearchPeople";
import { useToggleFollow } from "./useToggleFollow";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { useAuth } from "../auth/AuthProvider";

interface SearchPeopleTabProps {
  query: string;
}

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  errorCode?: string;
}

const SearchPeopleTab: React.FC<SearchPeopleTabProps> = ({ query }) => {
  const trimmedQuery = query.trim();
  const { data, isLoading, isError, error } = useSearchPeople(trimmedQuery);
  const toggleFollow = useToggleFollow();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [startingConversationFor, setStartingConversationFor] =
    useState<string | null>(null);

  const results = data ?? [];

  const handleStartConversation = async (targetUserId: string) => {
    if (!user?.id) {
      // Shouldn't normally happen because search is behind auth, but guard just in case.
      alert("You need to be signed in to start a conversation.");
      return;
    }

    if (user.id === targetUserId) {
      alert("You can't start a conversation with yourself.");
      return;
    }

    setStartingConversationFor(targetUserId);

    try {
      const payload = await callSupabaseFunction<CreateDirectConversationResponse>(
        "create-direct-conversation",
        { targetUserId },
        { timeoutMs: 25000 },
      );

      if (!payload?.ok || !payload.conversationId) {
        const code = payload?.errorCode;
        let friendly = payload?.error ?? "Failed to get conversation id. Please try again.";

        if (code === "UNAUTHORIZED") {
          friendly = "You need to be signed in to start a conversation.";
        } else if (code === "BAD_REQUEST_SELF_TARGET") {
          friendly = "You can't start a conversation with yourself.";
        } else if (code === "SERVER_MISCONFIGURED") {
          friendly =
            "Messaging is temporarily unavailable due to a server issue. Please try again later.";
        }

        const err = new Error(friendly);
        (err as any).code = code;
        throw err;
      }

      navigate(`/messages/${payload.conversationId}`);
    } catch (err: unknown) {
      console.error("[SearchPeopleTab] Failed to start conversation", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation. Please try again.";
      alert(message);
    } finally {
      setStartingConversationFor(null);
    }
  };

  if (!trimmedQuery) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-secondary">
          Start typing a name or @username to find people. Once the social graph
          is wired up, you&apos;ll be able to follow friends and start
          conversations from here.
        </p>
        <div className="flex items-center gap-2 rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-bg-elevated/60 px-3 py-2 text-[11px] text-mn-text-muted">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Search for people you know, then follow or message them.</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-secondary">
          Searching for people…
        </p>
        <div className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-3 py-4 text-[11px] text-mn-text-muted">
          We&apos;ll show matching profiles here as soon as the results come
          back.
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-primary">
          Something went wrong.
        </p>
        <p className="text-[11px] text-mn-text-muted">
          {error?.message ??
            "We couldn&apos;t search for people right now. Please try again."}
        </p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-mn-text-secondary">
          No people found for{" "}
          <span className="rounded border border-mn-border-subtle bg-mn-bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
            &ldquo;{trimmedQuery}&rdquo;
          </span>
          . Try a different name or username.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-mn-text-secondary">
          Showing {results.length} profile
          {results.length === 1 ? "" : "s"} for{" "}
          <span className="rounded border border-mn-border-subtle bg-mn-bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-mn-text-primary">
            &ldquo;{trimmedQuery}&rdquo;
          </span>
        </p>
      </div>

      <ul className="divide-y divide-mn-border-subtle/60 rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80">
        {results.map((person) => {
          const displayName =
            person.displayName ?? person.username ?? "Unknown user";
          const handle = person.username ? `@${person.username}` : null;

          return (
            <li
              key={person.id}
              className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-mn-bg-elevated/80"
            >
              <Link
                to={person.username ? `/u/${person.username}` : `/u/${person.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mn-bg-elevated/80 text-[14px] font-semibold text-mn-text-primary">
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={displayName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : displayName ? (
                    displayName[0]?.toUpperCase()
                  ) : (
                    <User className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-mn-text-primary">
                    {displayName}
                  </p>
                  {handle && (
                    <p className="mt-0.5 text-[11px] text-mn-text-muted">
                      {handle}
                    </p>
                  )}
                  {person.bio && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-mn-text-secondary">
                      {person.bio}
                    </p>
                  )}
                  {(typeof person.followersCount === "number" ||
                    typeof person.followingCount === "number") && (
                    <p className="mt-0.5 text-[10px] text-mn-text-muted">
                      {typeof person.followersCount === "number" && (
                        <span>
                          {person.followersCount} follower
                          {person.followersCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {typeof person.followersCount === "number" &&
                        typeof person.followingCount === "number" && (
                          <span>{" · "}</span>
                        )}
                      {typeof person.followingCount === "number" && (
                        <span>following {person.followingCount}</span>
                      )}
                    </p>
                  )}
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toggleFollow.mutate({
                      targetUserId: person.id,
                      currentlyFollowing: person.isFollowing,
                    })
                  }
                  disabled={toggleFollow.isPending}
                  className={`inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-[10px] font-medium transition ${
                    person.isFollowing
                      ? "border border-mn-border-subtle/80 bg-mn-bg-elevated/80 text-mn-text-primary hover:border-mn-primary/70 hover:text-mn-text-primary disabled:opacity-60"
                      : "border border-transparent bg-mn-primary text-mn-bg hover:bg-mn-primary/90 disabled:opacity-60"
                  }`}
                >
                  {person.isFollowing ? (
                    <>
                      <UserMinus className="h-3 w-3" aria-hidden="true" />
                      <span>Following</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" aria-hidden="true" />
                      <span>Follow</span>
                    </>
                  )}
                </button>

                {user?.id !== person.id && (
                  <button
                    type="button"
                    onClick={() => handleStartConversation(person.id)}
                    disabled={startingConversationFor === person.id}
                    className="inline-flex items-center justify-center rounded-full border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-2.5 py-1.5 text-[10px] font-medium text-mn-text-primary shadow-mn-soft hover:border-mn-primary/70 hover:text-mn-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {startingConversationFor === person.id ? (
                      <span>Starting…</span>
                    ) : (
                      <>
                        <MessageCircle
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        <span>Message</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SearchPeopleTab;
