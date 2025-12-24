import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  LayoutGrid,
  PlaySquare,
  Tag,
  Menu,
  Plus,
  ChevronRight,
  UserPlus2,
  MessageCircle,
  MoreHorizontal,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/modules/auth/AuthProvider";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { useProfileByUsername } from "./useProfile";
import { useToggleFollow } from "@/modules/search/useToggleFollow";
import { useProfilePostCount } from "./useProfilePostCount";
import { useDiaryLibrary } from "@/modules/diary/useDiaryLibrary";
import DiaryTimelineTab from "@/modules/diary/DiaryTimelineTab";
import DiaryStatsTab from "@/modules/diary/DiaryStatsTab";
import { useSuggestedPeople } from "./useSuggestedPeople";
import { useProfileHighlights } from "./useProfileHighlights";
import { useCreateHighlight } from "./useCreateHighlight";

type ProfileTab = "grid" | "timeline" | "stats";

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  code?: string;
}

const formatHandle = (username: string | null | undefined) => {
  if (!username) return null;
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

const safeShare = async (title: string, url: string) => {
  try {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      // @ts-expect-error - share exists in supported browsers
      await navigator.share({ title, url });
      return;
    }
  } catch {
    // fall back
  }

  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // ignore
  }
};

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading, isError, error } = useProfileByUsername(username ?? "");
  const toggleFollow = useToggleFollow();
  const { data: postCount = 0 } = useProfilePostCount(profile?.id);

  const [tab, setTab] = React.useState<ProfileTab>("grid");
  React.useEffect(() => setTab("grid"), [username]);

  const isOwner = Boolean(profile?.isCurrentUser);
  const displayName = profile?.displayName || profile?.username || "Profile";
  const handle = formatHandle(profile?.username);

  const { data: libraryEntries = [], isLoading: libraryLoading } = useDiaryLibrary(profile?.id);

  const { data: suggested = [], dismissPerson } = useSuggestedPeople();
  const suggestedPreview = suggested.slice(0, 8);

  const { data: highlights = [], isLoading: highlightsLoading } = useProfileHighlights(
    profile?.id,
    isOwner,
  );
  const createHighlight = useCreateHighlight();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [highlightName, setHighlightName] = React.useState("Top movies");
  const [autoFill, setAutoFill] = React.useState(true);

  const [startingConversation, setStartingConversation] = React.useState(false);

  const handleStartConversation = async (targetUserId: string) => {
    if (!user?.id) {
      alert("You need to be signed in to start a conversation.");
      return;
    }

    if (user.id === targetUserId) {
      alert("You can't start a conversation with yourself.");
      return;
    }

    setStartingConversation(true);

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
      console.error("[ProfilePage] Failed to start conversation", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation. Please try again.";
      alert(message);
    } finally {
      setStartingConversation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
        Loading profile…
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center text-xs text-foreground shadow-lg">
          <p className="font-semibold">Unable to load this profile.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error?.message ?? "Please try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/u/${profile.username ?? username ?? ""}`;
  const followPending = toggleFollow.isPending && toggleFollow.variables?.targetUserId === profile.id;

  return (
    <div className="flex flex-1 flex-col pb-24">
      {/* Top header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="w-9" aria-hidden="true" />
          <h1 className="max-w-[70%] truncate text-sm font-semibold text-foreground">
            {displayName}
          </h1>
          <button
            type="button"
            onClick={() => {
              if (isOwner) navigate("/settings");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label={isOwner ? "Menu" : ""}
            disabled={!isOwner}
          >
            {isOwner ? (
              <Menu className="h-5 w-5" aria-hidden="true" />
            ) : (
              <span className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      {/* Profile header */}
      <section className="px-3 pt-4">
        <div className="flex gap-4">
          <div className="relative">
            <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-primary/40 bg-muted">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-foreground">
                  {getInitials(profile.displayName, profile.username)}
                </div>
              )}
            </div>

            {isOwner && (
              <div className="absolute -top-6 left-0 rounded-full bg-muted/90 px-3 py-1 text-[11px] text-muted-foreground shadow">
                What's on your mind?
              </div>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => navigate("/search?tab=titles")}
                className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow"
                aria-label="New diary entry"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-1 items-center justify-between gap-2">
            <div className="flex flex-1 justify-around gap-2">
              <button
                type="button"
                className="text-center"
                onClick={() => setTab("grid")}
                aria-label="View posts"
              >
                <p className="text-base font-semibold text-foreground">{postCount}</p>
                <p className="text-xs text-muted-foreground">posts</p>
              </button>

              <button
                type="button"
                className="text-center"
                onClick={() => {
                  const handle = profile.username ?? username;
                  if (!handle) return;
                  navigate(`/u/${handle}/followers`);
                }}
                aria-label="View followers"
              >
                <p className="text-base font-semibold text-foreground">{profile.followersCount}</p>
                <p className="text-xs text-muted-foreground">followers</p>
              </button>

              <button
                type="button"
                className="text-center"
                onClick={() => {
                  const handle = profile.username ?? username;
                  if (!handle) return;
                  navigate(`/u/${handle}/following`);
                }}
                aria-label="View following"
              >
                <p className="text-base font-semibold text-foreground">{profile.followingCount}</p>
                <p className="text-xs text-muted-foreground">following</p>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          {handle && <p className="text-xs text-muted-foreground">{handle}</p>}
          {profile.bio && <p className="mt-1 text-sm text-foreground">{profile.bio}</p>}
        </div>

        {/* Primary actions */}
        <div className="mt-4 flex items-center gap-2">
          {isOwner ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="h-10 flex-1 rounded-full bg-muted text-foreground hover:bg-muted/80"
                onClick={() => navigate("/settings/profile")}
              >
                Edit profile
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 flex-1 rounded-full bg-muted text-foreground hover:bg-muted/80"
                onClick={() => safeShare("My profile", profileUrl)}
              >
                Share profile
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-full bg-muted text-foreground hover:bg-muted/80"
                onClick={() => navigate("/suggested-people")}
                aria-label="Suggested people"
              >
                <UserPlus2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="h-10 flex-1 rounded-full"
                variant={profile.isFollowing ? "secondary" : "default"}
                disabled={followPending}
                onClick={() =>
                  toggleFollow.mutate({
                    targetUserId: profile.id,
                    currentlyFollowing: profile.isFollowing,
                  })
                }
              >
                {followPending ? "…" : profile.isFollowing ? "Following" : "Follow"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 flex-1 rounded-full bg-muted text-foreground hover:bg-muted/80"
                disabled={startingConversation}
                onClick={() => handleStartConversation(profile.id)}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Message
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full bg-muted text-foreground hover:bg-muted/80"
                    aria-label="More"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => safeShare(`${displayName}`, profileUrl)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>Report</DropdownMenuItem>
                  <DropdownMenuItem disabled>Block</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </section>

      {/* Discover people */}
      <section className="mt-6">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-sm font-semibold text-foreground">Discover people</h2>
          <button
            type="button"
            onClick={() => navigate("/suggested-people")}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            See all <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto px-3 pb-1">
          {suggestedPreview.map((person) => {
            const personName = person.displayName || person.username || "User";
            const pending =
              toggleFollow.isPending && toggleFollow.variables?.targetUserId === person.id;
            return (
              <div
                key={person.id}
                className="relative w-44 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card/80 p-3 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => dismissPerson(person.id)}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss suggestion"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => person.username && navigate(`/u/${person.username}`)}
                  className="flex w-full flex-col items-center"
                >
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={personName}
                      className="h-16 w-16 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                      {getInitials(person.displayName, person.username)}
                    </div>
                  )}
                  <p className="mt-2 w-full truncate text-center text-sm font-semibold text-foreground">
                    {personName}
                  </p>
                  <p className="w-full truncate text-center text-xs text-muted-foreground">
                    {typeof person.commonTitlesCount === "number" && person.commonTitlesCount > 0
                      ? `${person.commonTitlesCount} in common`
                      : "Suggested for you"}
                  </p>
                </button>
                <Button
                  type="button"
                  className="mt-3 h-9 w-full rounded-full"
                  disabled={pending}
                  variant={person.isFollowing ? "secondary" : "default"}
                  onClick={() =>
                    toggleFollow.mutate({
                      targetUserId: person.id,
                      currentlyFollowing: person.isFollowing,
                    })
                  }
                >
                  {pending ? "…" : person.isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Highlights */}
      <section className="mt-5">
        <div className="flex gap-3 overflow-x-auto px-3 pb-2">
          {isOwner && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card/80">
                <Plus className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-[10px] text-muted-foreground">New</span>
            </button>
          )}

          {highlightsLoading && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">Loading…</div>
          )}

          {highlights.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => navigate(`/lists/${h.id}`)}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="h-14 w-14 overflow-hidden rounded-full border border-border bg-muted">
                {h.coverPosterUrl ? (
                  <img
                    src={h.coverPosterUrl}
                    alt={h.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    {h.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="max-w-[64px] truncate text-[10px] text-muted-foreground">
                {h.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <section className="mt-4">
        <div className="flex items-center justify-around border-y border-border">
          <button
            type="button"
            onClick={() => setTab("grid")}
            className={
              "flex flex-1 items-center justify-center py-3 border-b-2 transition " +
              (tab === "grid"
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent")
            }
            aria-label="Grid"
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setTab("timeline")}
            className={
              "flex flex-1 items-center justify-center py-3 border-b-2 transition " +
              (tab === "timeline"
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent")
            }
            aria-label="Timeline"
          >
            <PlaySquare className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => isOwner && setTab("stats")}
            className={
              "flex flex-1 items-center justify-center py-3 border-b-2 transition " +
              (tab === "stats"
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent") +
              (!isOwner ? " opacity-40 pointer-events-none" : "")
            }
            aria-label="Stats"
            disabled={!isOwner}
          >
            <Tag className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {tab === "grid" && (
          <div className="px-2 pb-4">
            {libraryLoading ? (
              <div className="px-2 py-6 text-xs text-muted-foreground">Loading library…</div>
            ) : libraryEntries.length === 0 ? (
              <div className="flex min-h-[30vh] items-center justify-center px-4">
                <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-5 text-center text-xs text-muted-foreground shadow-lg">
                  <p className="font-heading text-sm font-semibold text-foreground">No titles yet</p>
                  <p className="mt-1 text-xs">
                    {isOwner
                      ? "Start rating titles and your library will appear here."
                      : "When they add titles to their diary, they’ll show up here."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {libraryEntries.map((entry) => (
                  <button
                    key={entry.titleId}
                    type="button"
                    className="overflow-hidden rounded-md border border-border bg-muted/30"
                    onClick={() => navigate(`/title/${entry.titleId}`)}
                  >
                    {entry.posterUrl ? (
                      <img
                        src={entry.posterUrl}
                        alt={entry.title ?? "Title"}
                        className="aspect-[2/3] w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-[2/3] w-full bg-muted" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "timeline" && (
          <DiaryTimelineTab
            userId={profile.id}
            isOwnProfile={isOwner}
            displayName={profile.displayName}
            username={profile.username}
          />
        )}

        {tab === "stats" && isOwner && <DiaryStatsTab />}
      </section>

      {/* Create highlight dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New highlight</DialogTitle>
            <DialogDescription>
              Create a saved list that shows up on your profile. "Top movies" works great as a starting point.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground">Name</label>
              <Input
                value={highlightName}
                onChange={(e) => setHighlightName(e.target.value)}
                placeholder="Top movies"
                className="mt-1"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoFill}
                onChange={(e) => setAutoFill(e.target.checked)}
              />
              Auto-fill with your top rated movies
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createHighlight.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                createHighlight.mutate(
                  { name: highlightName, autoFillTopMovies: autoFill },
                  {
                    onSuccess: ({ listId }) => {
                      setCreateOpen(false);
                      navigate(`/lists/${listId}`);
                    },
                  },
                )
              }
              disabled={createHighlight.isPending}
            >
              {createHighlight.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
