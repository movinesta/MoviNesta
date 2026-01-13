import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageCircle, User, UserMinus, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { useAuth } from "@/modules/auth/AuthProvider";

import { useToggleFollow } from "./useToggleFollow";
import { HighlightText } from "./HighlightText";

export type PersonRowData = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followersCount?: number | null;
  followingCount?: number | null;
  isFollowing: boolean;
  matchPercent?: number | null;
};

type CreateDirectConversationResponse = {
  ok: boolean;
  conversationId?: string;
  error?: string;
  code?: string;
};

const initialsFor = (displayName: string | null, username: string | null) => {
  const base = (displayName ?? username ?? "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const Avatar: React.FC<{
  avatarUrl: string | null;
  displayName: string | null;
  username: string | null;
  sizePx: number;
}> = ({ avatarUrl, displayName, username, sizePx }) => {
  const initials = initialsFor(displayName, username);
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? username ?? "Profile"}
        className="shrink-0 rounded-full object-cover"
        style={{ width: sizePx, height: sizePx }}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground"
      style={{ width: sizePx, height: sizePx }}
      aria-label="Profile initials"
    >
      {initials}
    </div>
  );
};

export const PeopleResultRow: React.FC<{
  person: PersonRowData;
  variant?: "compact" | "full";
  showFollow?: boolean;
  showMessage?: boolean;
  showDismiss?: boolean;
  onDismiss?: () => void;
  highlightQuery?: string;
  className?: string;
}> = ({
  person,
  variant = "full",
  showFollow = true,
  showMessage = true,
  showDismiss = false,
  onDismiss,
  highlightQuery,
  className,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toggleFollow = useToggleFollow();
  const [startingConversation, setStartingConversation] = React.useState(false);

  const displayName = person.displayName ?? person.username ?? "Unknown";
  const handle = person.username ? `@${person.username}` : null;
  const isSelf = Boolean(user?.id && user.id === person.id);

  const profileHref = person.username ? `/u/${person.username}` : `/u/${person.id}`;

  const isTogglingThis =
    toggleFollow.isPending && toggleFollow.variables?.targetUserId === person.id;

  const handleStartConversation = async () => {
    if (!user?.id) {
      alert("You need to be signed in to start a conversation.");
      return;
    }
    if (user.id === person.id) {
      alert("You can't start a conversation with yourself.");
      return;
    }

    setStartingConversation(true);
    try {
      const payload = await callSupabaseFunction<CreateDirectConversationResponse>(
        "create-direct-conversation",
        { targetUserId: person.id },
        { timeoutMs: 25000 },
      );

      if (!payload?.ok || !payload.conversationId) {
        const code = payload?.code;
        let friendly = payload?.error ?? "Failed to start a conversation. Please try again.";

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
      console.error("[PeopleResultRow] Failed to start conversation", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation. Please try again.";
      alert(message);
    } finally {
      setStartingConversation(false);
    }
  };

  const showFollowButton = showFollow && Boolean(user?.id) && !isSelf;
  const showMessageButton = showMessage && Boolean(user?.id) && !isSelf;
  const showDismissButton = showDismiss && Boolean(user?.id) && Boolean(onDismiss);

  const metaLine = () => {
    const hasCounts =
      typeof person.followersCount === "number" || typeof person.followingCount === "number";
    if (!hasCounts && !person.matchPercent) return null;

    return (
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {typeof person.matchPercent === "number" ? (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
            Match {person.matchPercent}%
          </span>
        ) : null}

        {typeof person.followersCount === "number" ? (
          <span>
            {person.followersCount} follower{person.followersCount === 1 ? "" : "s"}
          </span>
        ) : null}
        {typeof person.followersCount === "number" && typeof person.followingCount === "number" ? (
          <span>·</span>
        ) : null}
        {typeof person.followingCount === "number" ? (
          <span>following {person.followingCount}</span>
        ) : null}
      </div>
    );
  };

  if (variant === "compact") {
    const showCompactBio = Boolean(person.bio) && showDismiss;
    return (
      <div
        className={`soft-row-card flex min-h-11 items-center justify-between gap-3 row-pad ${className ?? ""}`}
      >
        <Link to={profileHref} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            avatarUrl={person.avatarUrl}
            displayName={person.displayName}
            username={person.username}
            sizePx={36}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <HighlightText
                text={displayName}
                query={highlightQuery}
                firstOnly
                className="block truncate text-sm font-semibold text-foreground"
              />
              {typeof person.matchPercent === "number" ? (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground">
                  Match {person.matchPercent}%
                </span>
              ) : null}
              {isSelf ? (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                  You
                </span>
              ) : null}
            </div>
            {handle ? (
              <HighlightText
                text={handle}
                query={highlightQuery}
                firstOnly
                className="block truncate text-xs text-muted-foreground"
              />
            ) : null}
            {showCompactBio ? (
              <HighlightText
                text={person.bio ?? ""}
                query={highlightQuery}
                firstOnly
                className="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                highlightClassName="rounded bg-primary/15 px-0.5 text-foreground ring-1 ring-primary/15"
              />
            ) : null}
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {showDismissButton ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="icon-hit"
              aria-label="Dismiss suggestion"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}

          {showMessageButton ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border bg-card/80 px-3 text-xs"
              onClick={handleStartConversation}
              disabled={startingConversation}
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}

          {showFollowButton ? (
            <Button
              type="button"
              onClick={() =>
                toggleFollow.mutate({
                  targetUserId: person.id,
                  currentlyFollowing: Boolean(person.isFollowing),
                })
              }
              disabled={isTogglingThis}
              variant={person.isFollowing ? "outline" : "default"}
              size="sm"
              className={`h-8 rounded-full px-3 text-xs font-medium ${
                person.isFollowing
                  ? "border-border bg-card/80 text-foreground hover:border-primary/70"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isTogglingThis ? (
                <span>…</span>
              ) : person.isFollowing ? (
                <>
                  <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Follow</span>
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`soft-row-card flex min-h-11 items-center justify-between gap-3 row-pad ${className ?? ""}`}
    >
      <Link to={profileHref} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card/80 text-[14px] font-semibold text-foreground">
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              alt={displayName}
              className="h-9 w-9 rounded-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : displayName ? (
            displayName[0]?.toUpperCase()
          ) : (
            <User className="h-4 w-4" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <HighlightText
              text={displayName}
              query={highlightQuery}
              firstOnly
              className="block truncate text-sm font-medium text-foreground"
            />
            {isSelf ? (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                You
              </span>
            ) : null}
          </div>

          {handle ? (
            <HighlightText
              text={handle}
              query={highlightQuery}
              firstOnly
              className="mt-0.5 block truncate text-xs text-muted-foreground"
            />
          ) : null}
          {person.bio ? (
            <HighlightText
              text={person.bio}
              query={highlightQuery}
              firstOnly
              className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
              highlightClassName="rounded bg-primary/15 px-0.5 text-foreground ring-1 ring-primary/15"
            />
          ) : null}
          {metaLine()}
        </div>
      </Link>

      <div className="flex items-center gap-2">
        {showDismissButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="icon-hit"
            aria-label="Dismiss suggestion"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}

        {showFollowButton ? (
          <Button
            type="button"
            onClick={() =>
              toggleFollow.mutate({
                targetUserId: person.id,
                currentlyFollowing: Boolean(person.isFollowing),
              })
            }
            disabled={isTogglingThis}
            variant={person.isFollowing ? "outline" : "default"}
            size="sm"
            className={`h-auto rounded-full px-2.5 py-1.5 text-xs font-medium ${
              person.isFollowing
                ? "border-border bg-card/80 text-foreground hover:border-primary/70 disabled:opacity-60"
                : "border border-transparent bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            }`}
          >
            {isTogglingThis ? (
              <span>Updating…</span>
            ) : person.isFollowing ? (
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
          </Button>
        ) : null}

        {showMessageButton ? (
          <Button
            type="button"
            onClick={handleStartConversation}
            disabled={startingConversation}
            variant="outline"
            size="sm"
            className="h-auto rounded-full border-border bg-card/80 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md hover:border-primary/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startingConversation ? (
              <span>Starting…</span>
            ) : (
              <>
                <MessageCircle className="h-3 w-3" aria-hidden="true" />
                <span>Message</span>
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
};
