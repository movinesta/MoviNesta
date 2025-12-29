import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Settings, Share2, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAppUrl } from "@/lib/appUrl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { supabase } from "@/lib/supabase";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";
import { rating0_10ToStars } from "@/lib/ratings";
import { useAuth } from "@/modules/auth/AuthProvider";
import { useProfileByUsername } from "./useProfile";
import { useToggleFollow } from "@/modules/search/useToggleFollow";
import { useSuggestedPeople } from "./useSuggestedPeople";
import { useDiaryLibrary } from "@/modules/diary/useDiaryLibrary";

type ProfileTab = "favorites" | "recent" | "watchlist" | "lists" | "reviews";

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

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 10_000) return `${Math.round(value / 100) / 10}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(value);
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

function PosterTile({
  title,
  imageUrl,
  onClick,
}: {
  title: string;
  imageUrl: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-muted/40 text-left"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {title}
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
      <div className="absolute inset-x-0 bottom-0 flex h-1/4 items-end bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2">
        <p className="truncate text-xs font-medium text-white">{title}</p>
      </div>
    </button>
  );
}

function SuggestedPersonCard({
  id,
  displayName,
  username,
  avatarUrl,
  matchPercent,
  isFollowing,
  onFollow,
  onOpen,
}: {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  matchPercent?: number;
  isFollowing: boolean;
  onFollow: (userId: string) => void;
  onOpen: (username: string | null) => void;
}) {
  const subtitle =
    typeof matchPercent === "number" && matchPercent > 0
      ? `${matchPercent}% match`
      : isFollowing
        ? "Following"
        : "Similar taste";

  return (
    <div className="snap-start min-w-[140px] rounded-2xl border border-white/5 bg-card p-3">
      <button
        type="button"
        onClick={() => onOpen(username)}
        className="flex w-full flex-col items-center gap-3"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName ?? username ?? "User"}
            className="h-16 w-16 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {getInitials(displayName, username)}
          </div>
        )}
        <div className="w-full text-center">
          <p className="w-full truncate text-sm font-bold text-white">
            {displayName ?? username ?? "User"}
          </p>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </button>
      <Button
        type="button"
        onClick={() => onFollow(id)}
        className={cn(
          "mt-3 h-8 w-full rounded-full text-xs font-bold",
          isFollowing ? "bg-white/10 hover:bg-white/20" : "bg-primary hover:bg-primary/80",
        )}
      >
        {isFollowing ? "Following" : "Follow"}
      </Button>
    </div>
  );
}

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, isError, error } = useProfileByUsername(username ?? "");
  const toggleFollow = useToggleFollow();

  const isOwner = Boolean(profile?.isCurrentUser);
  const displayName = profile?.displayName || profile?.username || "Profile";
  const handle = formatHandle(profile?.username);

  const [tab, setTab] = React.useState<ProfileTab>("favorites");
  React.useEffect(() => setTab("favorites"), [username]);

  const {
    entries: libraryEntries,
    isLoading: libraryLoading,
    isError: libraryError,
  } = useDiaryLibrary({ status: "all", type: "all" }, profile?.id);

  const watchedCount = React.useMemo(
    () => libraryEntries.filter((e) => e.status === "watched").length,
    [libraryEntries],
  );

  const favorites = React.useMemo(() => {
    const rated = libraryEntries
      .filter((e) => typeof e.rating === "number")
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const strong = rated.filter((e) => (e.rating ?? 0) >= 4);
    return (strong.length ? strong : rated).slice(0, 60);
  }, [libraryEntries]);

  const recentWatched = React.useMemo(() => {
    return libraryEntries
      .filter((e) => e.status === "watched")
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 60);
  }, [libraryEntries]);

  const watchlist = React.useMemo(() => {
    return libraryEntries
      .filter((e) => e.status === "want_to_watch")
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 60);
  }, [libraryEntries]);

  const coverUrl = React.useMemo(() => {
    const candidate =
      favorites.find((e) => Boolean(e.posterUrl)) ??
      recentWatched.find((e) => Boolean(e.posterUrl)) ??
      libraryEntries.find((e) => Boolean(e.posterUrl));
    return candidate?.posterUrl ?? null;
  }, [favorites, recentWatched, libraryEntries]);

  const { data: suggested = [] } = useSuggestedPeople();
  const suggestedPreview = suggested.slice(0, 10);

  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ["profile", "lists", profile?.id ?? null, isOwner],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [] as { id: string; name: string; description: string | null; is_public: boolean }[];
      let query = supabase
        .from("lists")
        .select("id, name, description, is_public, updated_at")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (!isOwner) {
        query = query.eq("is_public", true);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as any;
    },
  });

  const listsCount = lists.length;

  const { data: listCovers = new Map<string, string | null>() } = useQuery({
    queryKey: ["profile", "listCovers", profile?.id ?? null, lists.map((l) => l.id).join(",")],
    enabled: Boolean(profile?.id) && lists.length > 0,
    queryFn: async () => {
      const listIds = lists.map((l) => l.id);
      const { data: items, error: itemsError } = await supabase
        .from("list_items")
        .select("list_id, title_id, position")
        .in("list_id", listIds)
        .order("position", { ascending: true })
        .limit(400);
      if (itemsError) {
        console.warn("[ProfilePageV2] Failed to load list_items", itemsError.message);
        return new Map<string, string | null>();
      }

      const firstByList = new Map<string, string>();
      (items ?? []).forEach((row: any) => {
        if (!row?.list_id || !row?.title_id) return;
        if (firstByList.has(row.list_id)) return;
        firstByList.set(row.list_id, row.title_id);
      });

      const titleIds = Array.from(new Set(Array.from(firstByList.values())));
      if (!titleIds.length) return new Map<string, string | null>();

      const { data: titles, error: titlesError } = await supabase
        .from("media_items")
        .select(
          `id,
           kind,
           tmdb_title,
           tmdb_name,
           tmdb_original_title,
           tmdb_original_name,
           tmdb_release_date,
           tmdb_first_air_date,
           tmdb_poster_path,
           tmdb_backdrop_path,
           tmdb_original_language,
           omdb_title,
           omdb_year,
           omdb_language,
           omdb_imdb_id,
           omdb_imdb_rating,
           omdb_rating_rotten_tomatoes,
           omdb_poster,
           omdb_rated,
           tmdb_id`,
        )
        .in("id", titleIds)
        .limit(200);

      if (titlesError) {
        console.warn("[ProfilePageV2] Failed to load list cover titles", titlesError.message);
        return new Map<string, string | null>();
      }

      const posterByTitleId = new Map(
        (titles as MediaItemRow[]).map((row) => {
          const summary = mapMediaItemToSummary(row);
          return [summary.id, summary.posterUrl ?? summary.backdropUrl ?? null] as const;
        }),
      );

      const coverByList = new Map<string, string | null>();
      firstByList.forEach((titleId, listId) => {
        coverByList.set(listId, posterByTitleId.get(titleId) ?? null);
      });
      return coverByList;
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["profile", "reviews", profile?.id ?? null],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data: rows, error: reviewsError } = await supabase
        .from("reviews")
        .select("id, title_id, content_type, rating, headline, body, spoiler, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(80);

      if (reviewsError) throw new Error(reviewsError.message);

      const base = (rows ?? []) as any[];
      const titleIds = Array.from(new Set(base.map((r) => r.title_id).filter(Boolean)));
      const titleById = new Map<string, { title: string; posterUrl: string | null }>();

      if (titleIds.length) {
        const { data: titles, error: titlesError } = await supabase
          .from("media_items")
          .select(
            `id,
             kind,
             tmdb_title,
             tmdb_name,
             tmdb_original_title,
             tmdb_original_name,
             tmdb_release_date,
             tmdb_first_air_date,
             tmdb_poster_path,
             tmdb_backdrop_path,
             tmdb_original_language,
             omdb_title,
             omdb_year,
             omdb_language,
             omdb_imdb_id,
             omdb_imdb_rating,
             omdb_rating_rotten_tomatoes,
             omdb_poster,
             omdb_rated,
             tmdb_id`,
          )
          .in("id", titleIds)
          .limit(200);

        if (!titlesError && titles) {
          (titles as MediaItemRow[]).forEach((row) => {
            const summary = mapMediaItemToSummary(row);
            titleById.set(summary.id, { title: summary.title, posterUrl: summary.posterUrl });
          });
        }
      }

      return base.map((r) => {
        const title = titleById.get(r.title_id);
        return {
          id: r.id,
          titleId: r.title_id,
          title: title?.title ?? "Untitled",
          posterUrl: title?.posterUrl ?? null,
          ratingStars: rating0_10ToStars(r.rating ?? null),
          headline: r.headline as string | null,
          body: r.body as string | null,
          spoiler: Boolean(r.spoiler),
          createdAt: r.created_at as string,
        };
      });
    },
  });

  const [startingConversation, setStartingConversation] = React.useState(false);
  const startConversation = async (targetUserId: string) => {
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
        throw new Error(payload?.error ?? "Failed to start conversation");
      }
      navigate(`/messages/${payload.conversationId}`);
    } catch (err) {
      console.error("[ProfilePageV2] Failed to start conversation", err);
      alert("Couldn't start conversation. Please try again.");
    } finally {
      setStartingConversation(false);
    }
  };

  const [createListOpen, setCreateListOpen] = React.useState(false);
  const [newListName, setNewListName] = React.useState("");
  const [newListDescription, setNewListDescription] = React.useState("");

  const createList = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const name = newListName.trim();
      if (!name) throw new Error("List name is required");

      const { data, error } = await supabase
        .from("lists")
        .insert({
          user_id: user.id,
          name,
          description: newListDescription.trim() ? newListDescription.trim() : null,
          is_public: false,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);
      return data as { id: string };
    },
    onSuccess: async (data) => {
      setCreateListOpen(false);
      setNewListName("");
      setNewListDescription("");
      await queryClient.invalidateQueries({ queryKey: ["profile", "lists", profile?.id ?? null] });
      if (data?.id) navigate(`/lists/${data.id}`);
    },
  });

  const onFollow = async (targetUserId: string) => {
    if (!profile?.id) return;
    await toggleFollow.mutateAsync(targetUserId);
    queryClient.invalidateQueries({ queryKey: ["suggested-people", user?.id ?? null] });
  };

  const profileUrl = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildAppUrl(`/u/${profile?.username ?? ""}`);
  }, [profile?.username]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
          Loading profile…
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex flex-1 flex-col px-4 py-12">
        <div className="mx-auto max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center text-xs text-foreground shadow-lg">
          <p className="font-semibold">Unable to load profile.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error?.message ?? "Please try again in a moment."}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
        </div>
      </div>
    );
  }

  const canShowDiscoverPeople = isOwner && suggestedPreview.length > 0;

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "favorites", label: "Favorites" },
    { id: "recent", label: "Recent" },
    { id: "watchlist", label: "Watchlist" },
    { id: "lists", label: "Lists" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="relative flex min-h-screen w-full flex-1 flex-col pb-24">
      {/* Header */}
      <div className="relative h-80 w-full shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Profile cover"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0611] via-[#150b1e] to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />

        <div className="absolute left-0 top-0 z-20 flex w-full items-center justify-between p-4 pt-12 md:pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition-colors hover:bg-black/40"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Avatar + core info */}
      <div className="relative z-10 -mt-20 px-5">
        <div className="flex flex-col items-start gap-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-primary/30 blur-md" />
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="relative h-28 w-28 rounded-full border-4 border-background bg-card object-cover shadow-xl"
              />
            ) : (
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-background bg-card text-2xl font-bold text-muted-foreground shadow-xl">
                {getInitials(profile.displayName, profile.username)}
              </div>
            )}
          </div>

          <div className="w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
                  {displayName}
                </h1>
                {handle ? (
                  <p className="mt-1 text-base font-medium text-muted-foreground">{handle}</p>
                ) : null}
              </div>

              <div className="mt-1 flex items-center gap-2">
                {isOwner ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 rounded-full bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20"
                    onClick={() => navigate("/settings/profile")}
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className={cn(
                      "h-9 rounded-full px-5 text-sm font-semibold",
                      profile.isFollowing
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-primary text-white hover:bg-primary/80",
                    )}
                    disabled={toggleFollow.isPending}
                    onClick={async () => {
                      await toggleFollow.mutateAsync(profile.id);
                      await queryClient.invalidateQueries({
                        queryKey: ["profile", "byUsername", profile.username ?? "", user?.id ?? null],
                      });
                    }}
                  >
                    {profile.isFollowing ? "Following" : "Follow"}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={() => safeShare(`${displayName} on MoviNesta`, profileUrl)}
                  aria-label="Share profile"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {profile.bio ? (
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-300">{profile.bio}</p>
            ) : null}

            {!isOwner ? (
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 rounded-full bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                  onClick={() => startConversation(profile.id)}
                  disabled={startingConversation}
                >
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between px-6 py-8">
        <button
          type="button"
          onClick={() => setTab("recent")}
          className="group flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold text-white transition-colors group-hover:text-primary">
            {formatCount(watchedCount)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Watched
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("lists")}
          className="group flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold text-white transition-colors group-hover:text-primary">
            {formatCount(listsCount)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lists
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/u/${profile.username}/followers`)}
          className="group flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold text-white transition-colors group-hover:text-primary">
            {formatCount(profile.followersCount)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Followers
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/u/${profile.username}/following`)}
          className="group flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold text-white transition-colors group-hover:text-primary">
            {formatCount(profile.followingCount)}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Following
          </span>
        </button>
      </div>

      {/* Discover people */}
      {canShowDiscoverPeople ? (
        <div className="mb-8 pl-5">
          <h3 className="mb-4 text-lg font-bold text-white">Discover People</h3>
          <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-4 pr-5">
            {suggestedPreview.map((person) => (
              <SuggestedPersonCard
                key={person.id}
                id={person.id}
                displayName={person.displayName}
                username={person.username}
                avatarUrl={person.avatarUrl}
                matchPercent={person.matchPercent}
                isFollowing={person.isFollowing}
                onFollow={onFollow}
                onOpen={(u) => {
                  if (u) navigate(`/u/${u.replace(/^@/, "")}`);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="sticky top-0 z-20 border-b border-white/5 bg-background/80 px-5 backdrop-blur-lg">
        <div className="no-scrollbar flex gap-8 overflow-x-auto">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative shrink-0 py-4 text-sm transition-colors",
                  active ? "font-bold text-white" : "font-medium text-muted-foreground hover:text-white",
                )}
              >
                {t.label}
                {active ? (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full bg-primary shadow-[0_0_10px_rgba(127,19,236,0.5)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[420px] p-4">
        {libraryError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs text-muted-foreground">
            Failed to load library.
          </div>
        ) : null}

        {tab === "favorites" ? (
          <div className="grid grid-cols-3 gap-3">
            {(libraryLoading ? [] : favorites).map((entry) => (
              <PosterTile
                key={entry.id}
                title={entry.title}
                imageUrl={entry.posterUrl}
                onClick={() => navigate(`/title/${entry.titleId}`)}
              />
            ))}
            {!libraryLoading && favorites.length === 0 ? (
              <div className="col-span-3 rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                No favorites yet.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "recent" ? (
          <div className="grid grid-cols-3 gap-3">
            {(libraryLoading ? [] : recentWatched).map((entry) => (
              <PosterTile
                key={entry.id}
                title={entry.title}
                imageUrl={entry.posterUrl}
                onClick={() => navigate(`/title/${entry.titleId}`)}
              />
            ))}
            {!libraryLoading && recentWatched.length === 0 ? (
              <div className="col-span-3 rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                No watched titles yet.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "watchlist" ? (
          <div className="grid grid-cols-3 gap-3">
            {(libraryLoading ? [] : watchlist).map((entry) => (
              <PosterTile
                key={entry.id}
                title={entry.title}
                imageUrl={entry.posterUrl}
                onClick={() => navigate(`/title/${entry.titleId}`)}
              />
            ))}
            {!libraryLoading && watchlist.length === 0 ? (
              <div className="col-span-3 rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                Watchlist is empty.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "lists" ? (
          <div className="grid grid-cols-2 gap-3">
            {listsLoading ? null :
              lists.map((list) => {
                const cover = listCovers.get(list.id) ?? null;
                return (
                  <button
                    type="button"
                    key={list.id}
                    onClick={() => navigate(`/lists/${list.id}`)}
                    className="group relative overflow-hidden rounded-2xl border border-white/5 bg-card text-left"
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={list.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                    <div className="relative p-4">
                      <p className="text-sm font-bold text-white">{list.name}</p>
                      {list.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {list.description}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {list.is_public ? "Public list" : "Private list"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

            {!listsLoading && lists.length === 0 ? (
              <div className="col-span-2 rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                No lists yet.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "reviews" ? (
          <div className="space-y-3">
            {reviewsLoading ? (
              <div className="rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                Loading reviews…
              </div>
            ) : null}

            {!reviewsLoading && reviews.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-card p-5 text-center text-xs text-muted-foreground">
                No reviews yet.
              </div>
            ) : null}

            {!reviewsLoading
              ? reviews.map((review) => (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => navigate(`/title/${review.titleId}`)}
                    className="flex w-full gap-3 rounded-2xl border border-white/5 bg-card p-4 text-left"
                  >
                    <div className="h-16 w-12 overflow-hidden rounded-lg bg-muted/40">
                      {review.posterUrl ? (
                        <img
                          src={review.posterUrl}
                          alt={review.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">{review.title}</p>
                        {typeof review.ratingStars === "number" ? (
                          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                            {review.ratingStars.toFixed(1)}★
                          </span>
                        ) : null}
                      </div>
                      {review.headline ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {review.headline}
                        </p>
                      ) : null}
                      {review.body ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {review.spoiler ? "Spoiler hidden" : review.body}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>

      {/* Floating action */}
      {isOwner ? (
        <button
          type="button"
          onClick={() => setCreateListOpen(true)}
          className="fixed bottom-24 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 transition-transform active:scale-95"
          aria-label="Create list"
        >
          <Plus className="h-7 w-7 text-white" />
        </button>
      ) : null}

      <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a list</DialogTitle>
            <DialogDescription>
              Start a curated collection you can share later. You can add titles from any title page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. Cozy Sci‑Fi"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Input
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Why this list exists…"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateListOpen(false)}
              disabled={createList.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => createList.mutate()}
              disabled={createList.isPending}
            >
              {createList.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;