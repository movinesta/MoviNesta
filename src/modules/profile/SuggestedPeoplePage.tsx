import React from "react";
import { useNavigate } from "react-router-dom";
import { X, UserPlus2, MessageCircle, MoreHorizontal, Copy } from "lucide-react";
import TopBar from "@/components/shared/TopBar";
import { Button } from "@/components/ui/button";
import VerifiedBadge from "@/components/VerifiedBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildAppUrl } from "@/lib/appUrl";
import { useSuggestedPeople } from "./useSuggestedPeople";
import { useToggleFollow } from "@/modules/search/useToggleFollow";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { useAuth } from "@/modules/auth/AuthProvider";

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  code?: string;
}

const copyToClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore
  }
};

const formatHandle = (username: string | null) => {
  if (!username) return "";
  return username.startsWith("@") ? username : `@${username}`;
};

const getInitials = (displayName?: string | null, username?: string | null) => {
  const source = displayName || username || "";
  const cleaned = source.replace(/^@/, "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const SuggestedPeoplePage: React.FC = () => {
  const navigate = useNavigate();
  const { data: people = [], isLoading, isError, error, dismissPerson } = useSuggestedPeople();
  const toggleFollow = useToggleFollow();
  const { user } = useAuth();
  const [startingConversationFor, setStartingConversationFor] = React.useState<string | null>(null);

  const handleStartConversation = async (targetUserId: string) => {
    if (!user?.id) {
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
        const code = payload?.code;
        let friendly = payload?.error ?? "Failed to get conversation id. Please try again.";

        if (code === "UNAUTHORIZED") {
          friendly = "You need to be signed in to start a conversation.";
        } else if (code === "BAD_REQUEST_SELF_TARGET") {
          friendly = "You can't start a conversation with yourself.";
        } else if (code === "SERVER_MISCONFIGURED") {
          friendly =
            "Messaging is temporarily unavailable due to a server issue. Please try again later.";
        }

        throw new Error(friendly);
      }

      navigate(`/messages/${payload.conversationId}`);
    } catch (err: unknown) {
      console.error("[SuggestedPeoplePage] Failed to start conversation", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation. Please try again.";
      alert(message);
    } finally {
      setStartingConversationFor(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-2">
      <TopBar title="Suggested people" onBack={() => navigate(-1)} />

      {isLoading && (
        <div className="page-pad-all text-xs text-muted-foreground">Loading suggestions…</div>
      )}

      {isError && (
        <div className="page-pad-all">
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 card-pad text-xs text-foreground shadow-sm">
            <p className="font-semibold">Unable to load suggestions.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error?.message ?? "Please try again in a moment."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && people.length === 0 && (
        <div className="flex flex-1 items-center justify-center page-pad-all">
          <div className="max-w-sm rounded-2xl border border-border bg-card/80 card-pad text-center text-xs text-muted-foreground shadow-sm">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
              <UserPlus2 className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <p className="font-heading text-sm font-semibold text-foreground">All caught up</p>
            <p className="mt-1 text-xs">No new suggestions right now. Check back later.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col stack-gap page-pad-all">
        {people.map((person) => {
          const handle = formatHandle(person.username);
          const name = person.displayName || handle || "User";
          const pending =
            toggleFollow.isPending && toggleFollow.variables?.targetUserId === person.id;
          const starting = Boolean(
            startingConversationFor && startingConversationFor === person.id,
          );

          const hint =
            typeof person.commonTitlesCount === "number" && person.commonTitlesCount > 0
              ? `${person.commonTitlesCount} in common`
              : "Suggested for you";

          return (
            <div
              key={person.id}
              className="relative overflow-hidden rounded-2xl border border-border bg-card/80 card-pad shadow-sm"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => dismissPerson(person.id)}
                className="absolute right-1 top-1 rounded-full text-muted-foreground"
                aria-label="Dismiss suggestion"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>

              <div
                className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (person.username) navigate(`/u/${person.username}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && person.username) navigate(`/u/${person.username}`);
                }}
              >
                {person.avatarUrl ? (
                  <img
                    src={person.avatarUrl}
                    alt={name}
                    className="h-12 w-12 rounded-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                    {getInitials(person.displayName, person.username)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {person.isVerified ? (
                      <VerifiedBadge
                        isVerified={person.isVerified ?? null}
                        type={(person.verifiedType as any) ?? null}
                        label={person.verifiedLabel ?? null}
                        verifiedAt={person.verifiedAt ?? null}
                        org={person.verifiedByOrg ?? null}
                      />
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{handle}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{hint}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollow.mutate({
                        targetUserId: person.id,
                        currentlyFollowing: person.isFollowing,
                      });
                    }}
                    className={
                      person.isFollowing
                        ? "rounded-full bg-muted px-3 text-foreground hover:bg-muted/80"
                        : "rounded-full px-3"
                    }
                  >
                    {pending ? "…" : person.isFollowing ? "Following" : "Follow"}
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="rounded-full"
                    disabled={starting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartConversation(person.id);
                    }}
                    aria-label="Message"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="rounded-full"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="More"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => {
                          if (!person.username) return;
                          copyToClipboard(buildAppUrl(`/u/${person.username}`));
                        }}
                        disabled={!person.username}
                      >
                        <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                        Copy profile link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>Report</DropdownMenuItem>
                      <DropdownMenuItem disabled>Block</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SuggestedPeoplePage;
