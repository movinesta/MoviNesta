import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RatingStars } from "../../components/RatingStars";
import { useQuery } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import {
  useDiaryLibraryMutations,
  useTitleDiaryEntry,
  type DiaryStatus,
} from "../diary/useDiaryLibrary";
import { diaryStatusLabel, diaryStatusPillClasses } from "../diary/diaryStatus";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { supabase } from "../../lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { tmdbImageUrl } from "@/lib/tmdb";
import { TitleType } from "@/types/supabase-helpers";

interface TitleRow {
  title_id: string;

  // Core identity
  content_type: string | null;
  primary_title: string | null;
  original_title: string | null;
  sort_title: string | null;

  // Dates & runtime
  release_year: number | null;
  release_date: string | null;
  runtime_minutes: number | null;
  tmdb_runtime: number | null;
  tmdb_episode_run_time: number[] | null;

  // Story / description
  plot: string | null;
  tmdb_overview: string | null;
  tagline: string | null;

  // People
  omdb_director: string | null;
  omdb_actors: string | null;

  // Genres & locale
  genres: string[] | null;
  tmdb_genre_names: string[] | null;
  language: string | null;
  omdb_language: string | null;
  tmdb_original_language: string | null;
  country: string | null;
  omdb_country: string | null;

  // Ratings
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  rt_tomato_pct: number | null;

  // Artwork
  poster_url: string | null;
  tmdb_poster_path: string | null;
  backdrop_url: string | null;
}

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  errorCode?: string;
}

type RatingsProps = {
  imdb_rating: number | null;
  rt_tomato_pct: number | null;
  metascore: number | null;
};

const ExternalRatingsChips: React.FC<RatingsProps> = ({
  imdb_rating,
  rt_tomato_pct,
  metascore,
}) => {
  const hasAnyRating =
    (typeof imdb_rating === "number" && imdb_rating > 0) ||
    (typeof rt_tomato_pct === "number" && rt_tomato_pct > 0) ||
    (typeof metascore === "number" && metascore > 0);

  if (!hasAnyRating) return null;

  const hasImdbRating =
    typeof imdb_rating === "number" && !Number.isNaN(imdb_rating) && imdb_rating > 0;
  const hasTomatometer =
    typeof rt_tomato_pct === "number" && !Number.isNaN(rt_tomato_pct) && rt_tomato_pct > 0;
  const hasMetacriticScore =
    typeof metascore === "number" && !Number.isNaN(metascore) && metascore > 0;

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-mn-text-muted">
      {hasImdbRating && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">IMDb Rating</span>
          {imdb_rating.toFixed(1)}
        </span>
      )}

      {hasTomatometer && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">Tomatometer</span>
          {rt_tomato_pct}%
        </span>
      )}

      {hasMetacriticScore && (
        <span className="inline-flex items-center rounded-full border border-mn-border-subtle px-2 py-0.5">
          <span className="mr-1 font-semibold">MC</span>
          {metascore}
        </span>
      )}
    </div>
  );
};

const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();
  const navigate = useNavigate();
  const [startingConversationFor, setStartingConversationFor] = React.useState<string | null>(null);

  const handleStartConversation = async (targetUserId: string) => {
    if (!user?.id) {
      alert("You need to be signed in to start a conversation.");
      return;
    }

    if (user.id === targetUserId) {
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
      console.error("[TitleDetailPage] Failed to start conversation", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong while starting the conversation. Please try again.";
      alert(message);
    } finally {
      setStartingConversationFor(null);
    }
  };

  const { data, isLoading, isError } = useQuery<TitleRow | null, Error>({
    queryKey: qk.titleDetail(titleId),
    enabled: Boolean(titleId),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!titleId) return null;

      const { data, error } = await supabase
        .from("titles")
        .select(
          `
          title_id,
          content_type,
          primary_title,
          original_title,
          sort_title,
          release_year,
          release_date,
          runtime_minutes,
          tmdb_runtime,
          tmdb_episode_run_time,
          plot,
          tmdb_overview,
          tagline,
          omdb_director,
          omdb_actors,
          genres,
          tmdb_genre_names,
          language,
          omdb_language,
          tmdb_original_language,
          country,
          omdb_country,
          imdb_rating,
          imdb_votes,
          metascore,
          rt_tomato_pct,
          poster_url,
          tmdb_poster_path,
          backdrop_url
        `,
        )
        .eq("title_id", titleId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as TitleRow | null;
    },
  });

  const { user } = useAuth();
  const { updateStatus, updateRating } = useDiaryLibraryMutations();
  const { data: diaryEntryData } = useTitleDiaryEntry(titleId);
  const diaryEntry = diaryEntryData ?? { status: null, rating: null };
  const { data: friendsReactions, isLoading: friendsReactionsLoading } = useQuery<
    {
      userId: string;
      displayName: string | null;
      username: string | null;
      avatarUrl: string | null;
      rating: number | null;
      createdAt: string | null;
    }[]
  >({
    queryKey: qk.friendsTitleReactions(user?.id ?? null, titleId),
    enabled: Boolean(user?.id && titleId),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!user?.id || !titleId) return [];

      const userId = user.id;

      // 1) Find people the current user follows.
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", userId)
        .limit(80);

      if (followsError) {
        throw followsError;
      }

      const friendIds = (follows ?? [])
        .map((row: any) => row.followed_id as string)
        .filter(Boolean);

      if (!friendIds.length) return [];

      // 2) Fetch their ratings for this title.
      const { data: ratings, error: ratingsError } = await supabase
        .from("ratings")
        .select("user_id, rating, created_at")
        .eq("title_id", titleId)
        .in("user_id", friendIds)
        .order("rating", { ascending: false })
        .limit(40);

      if (ratingsError) {
        throw ratingsError;
      }

      const ratedUserIds = (ratings ?? []).map((r: any) => r.user_id as string);

      if (!ratedUserIds.length) return [];

      // 3) Load profile info for those users.
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", ratedUserIds);

      if (profilesError) {
        throw profilesError;
      }

      const profilesById = new Map(
        (profiles ?? []).map((p: any) => [
          p.id as string,
          {
            displayName: (p.display_name as string | null) ?? null,
            username: (p.username as string | null) ?? null,
            avatarUrl: (p.avatar_url as string | null) ?? null,
          },
        ]),
      );

      const merged = (ratings ?? []).map((r: any) => {
        const pid = r.user_id as string;
        const profile = profilesById.get(pid);
        return {
          userId: pid,
          displayName: profile?.displayName ?? null,
          username: profile?.username ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          rating: (r.rating as number | null) ?? null,
          createdAt: (r.created_at as string | null) ?? null,
        };
      });

      // De-duplicate by userId, keeping the highest rating.
      const dedup = new Map<string, (typeof merged)[number]>();
      for (const item of merged) {
        const existing = dedup.get(item.userId);
        if (!existing || (item.rating ?? 0) > (existing.rating ?? 0)) {
          dedup.set(item.userId, item);
        }
      }

      return Array.from(dedup.values()).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    },
  });

  const posterImage = data
    ? (data.poster_url ?? tmdbImageUrl(data.tmdb_poster_path, "w500"))
    : null;

  const backdropImage = data ? data.backdrop_url : null;

  React.useEffect(() => {
    const urls = [posterImage, backdropImage].filter((url): url is string => Boolean(url));
    if (urls.length === 0) return;

    urls.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [posterImage, backdropImage]);

  if (!titleId) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar
          title="Title details"
          subtitle="Pick something from search, your diary, or the feed to see its details."
        />

        <PageSection>
          <p className="text-sm text-mn-text-secondary">
            No title was specified for this page. Try opening it from search, your diary, or the{" "}
            home feed.
          </p>
        </PageSection>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Loading title" />
        <PageSection>
          <div className="flex gap-4">
            <div className="h-40 w-28 animate-pulse rounded-2xl bg-mn-bg-elevated/60 sm:h-52 sm:w-36" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="space-y-1.5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-mn-bg-elevated/60" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-mn-bg-elevated/40" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-mn-bg-elevated/40" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-mn-bg-elevated/30" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-mn-bg-elevated/30" />
              </div>
              <div className="mt-2 flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-mn-bg-elevated/50" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-mn-bg-elevated/40" />
              </div>
            </div>
          </div>
        </PageSection>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
        <TopBar title="Title not found" />
        <PageSection>
          <p className="text-sm text-mn-text-secondary">We couldn&apos;t find that title.</p>
          <Link to="/search" className="mt-3 inline-block text-sm text-mn-primary underline">
            Back to search
          </Link>
        </PageSection>
      </div>
    );
  }

  const displayTitle = data.primary_title ?? data.original_title ?? "Untitled";

  const derivedYear =
    data.release_year ?? (data.release_date ? new Date(data.release_date).getFullYear() : null);

  const runtimeMinutes =
    data.runtime_minutes ??
    data.tmdb_runtime ??
    (Array.isArray(data.tmdb_episode_run_time) && data.tmdb_episode_run_time.length > 0
      ? data.tmdb_episode_run_time[0]
      : null);

  const runtimeLabel =
    typeof runtimeMinutes === "number" && runtimeMinutes > 0
      ? `${Math.floor(runtimeMinutes / 60)}h ${runtimeMinutes % 60 ? `${runtimeMinutes % 60}m` : ""}`.trim()
      : null;

  const displayContentType =
    data.content_type === "movie"
      ? "Movie"
      : data.content_type === "series"
        ? "TV Series"
        : (data.content_type ?? null);

  const primaryLanguage =
    data.language ?? data.omdb_language ?? data.tmdb_original_language ?? null;

  const primaryCountry = data.country ?? data.omdb_country ?? null;

  const genres =
    (data.genres && data.genres.length > 0 && data.genres) ||
    (data.tmdb_genre_names && data.tmdb_genre_names.length > 0 && data.tmdb_genre_names) ||
    [];

  const overview = data.plot ?? data.tmdb_overview ?? null;

  const metaPieces: string[] = [];
  if (derivedYear) metaPieces.push(String(derivedYear));
  if (displayContentType) metaPieces.push(displayContentType);
  if (runtimeLabel) metaPieces.push(runtimeLabel);
  if (primaryCountry) metaPieces.push(primaryCountry);
  if (primaryLanguage) metaPieces.push(primaryLanguage);

  const externalImdbRating = data.imdb_rating;
  const externalMetascore = data.metascore;
  const externalTomato = data.rt_tomato_pct;

  const normalizedContentType: TitleType | null =
    data.content_type === "movie" || data.content_type === "series" ? data.content_type : null;

  const ensureSignedIn = () => {
    if (!user) {
      alert("Sign in to save this title to your diary or leave a rating.");
      return false;
    }
    return true;
  };

  const setDiaryStatus = (status: DiaryStatus) => {
    if (!ensureSignedIn() || updateStatus.isPending) return;

    updateStatus.mutate({ titleId: data.title_id, status, type: normalizedContentType });
  };

  const setDiaryRating = (nextRating: number | null) => {
    if (!ensureSignedIn() || updateRating.isPending) return;

    updateRating.mutate({
      titleId: data.title_id,
      rating: nextRating,
      type: normalizedContentType,
    });
  };

  const metaLine = metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details";

  const statusIs = (status: DiaryStatus) => diaryEntry?.status === status;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-mn-border-subtle bg-mn-bg-elevated/80 shadow-mn-soft">
        <div className="absolute inset-0">
          {backdropImage ? (
            <img
              src={backdropImage}
              alt={displayTitle}
              className="h-full w-full scale-105 object-cover blur-[1px]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-mn-bg via-mn-bg/70 to-mn-bg-elevated" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-mn-bg via-mn-bg/80 to-mn-bg/40" />
        </div>

        <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-end">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {posterImage ? (
              <img
                src={posterImage}
                alt={displayTitle}
                className="aspect-[2/3] w-full rounded-mn-card object-cover shadow-mn-card"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-bg/70 text-xs text-mn-text-muted">
                No poster available
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-mn-text-muted">
                {displayContentType ?? "Title"}
              </p>
              <h1 className="text-2xl font-semibold text-mn-text-primary sm:text-3xl">
                {displayTitle}
              </h1>
              <p className="text-[12.5px] text-mn-text-secondary">{metaLine}</p>
            </div>

            {overview && (
              <p className="max-w-3xl text-[13px] leading-relaxed text-mn-text-secondary sm:text-[14px]">
                {overview}
              </p>
            )}

            <ExternalRatingsChips
              imdb_rating={externalImdbRating}
              rt_tomato_pct={externalTomato}
              metascore={externalMetascore}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDiaryStatus("want_to_watch")}
                disabled={updateStatus.isPending}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                  statusIs("want_to_watch")
                    ? "border-mn-primary bg-mn-primary/10 text-mn-primary"
                    : "border-mn-border-subtle bg-mn-bg text-mn-text-primary hover:border-mn-primary/60 hover:text-mn-primary"
                }`}
              >
                Add to watchlist
              </button>
              <button
                type="button"
                onClick={() => setDiaryStatus("watching")}
                disabled={updateStatus.isPending}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                  statusIs("watching")
                    ? "border-mn-primary bg-mn-primary/10 text-mn-primary"
                    : "border-mn-border-subtle bg-mn-bg text-mn-text-primary hover:border-mn-primary/60 hover:text-mn-primary"
                }`}
              >
                I’m watching
              </button>
              <button
                type="button"
                onClick={() => setDiaryStatus("watched")}
                disabled={updateStatus.isPending}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${
                  statusIs("watched")
                    ? "border-mn-primary bg-mn-primary/10 text-mn-primary"
                    : "border-mn-border-subtle bg-mn-bg text-mn-text-primary hover:border-mn-primary/60 hover:text-mn-primary"
                }`}
              >
                Log as watched
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-mn-text-secondary">
              <span className="font-semibold text-mn-text-primary">Your rating</span>
              <RatingStars
                value={diaryEntry?.rating ?? null}
                disabled={updateRating.isPending}
                onChange={setDiaryRating}
              />
              {diaryEntry?.rating != null && (
                <span className="text-[11px] text-mn-text-muted">{diaryEntry.rating}/10</span>
              )}
            </div>

            {!user && (
              <p className="text-[11.5px] text-mn-text-muted">
                <Link to="/auth" className="font-medium text-mn-primary underline">
                  Sign in
                </Link>{" "}
                to log this title, rate it, or add it to your watchlist.
              </p>
            )}
          </div>
        </div>
      </div>

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            <div className="rounded-2xl border border-mn-border-subtle bg-mn-bg/80 px-3 py-3 text-[12px] text-mn-text-secondary">
              {data.tagline && (
                <p className="text-[13px] font-medium text-mn-text-primary">{data.tagline}</p>
              )}
              {overview && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-mn-text-secondary">
                  {overview}
                </p>
              )}
              {!data.tagline && !overview && (
                <p className="text-[12px] text-mn-text-muted">
                  We don&apos;t have a plot summary for this title yet.
                </p>
              )}
              {genres && genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {genres.slice(0, 6).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-mn-border-subtle px-2 py-[2px] text-[11px] text-mn-text-muted"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {(data.omdb_director || data.omdb_actors) && (
                <div className="mt-2 space-y-1 text-[11.5px] text-mn-text-muted">
                  {data.omdb_director && (
                    <p>
                      <span className="font-semibold text-mn-text-primary">Director:</span>{" "}
                      {data.omdb_director}
                    </p>
                  )}
                  {data.omdb_actors && (
                    <p>
                      <span className="font-semibold text-mn-text-primary">Cast:</span>{" "}
                      {data.omdb_actors}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-3 text-[12px] text-mn-text-secondary">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-mn-text-primary">Your diary</p>
                  <p className="mt-0.5 text-[11.5px] text-mn-text-muted">
                    Keep this title synced with the same diary data used across MoviNesta.
                  </p>
                </div>

                {user && (
                  <div className="flex flex-col items-end gap-2 text-[11px]">
                    <span className={diaryStatusPillClasses(diaryEntry?.status)}>
                      {diaryStatusLabel(diaryEntry?.status)}
                    </span>
                    <div className="flex items-center gap-2 text-mn-text-secondary">
                      <span className="font-medium text-mn-text-primary">Rating</span>
                      <RatingStars
                        value={diaryEntry?.rating ?? null}
                        disabled={updateRating.isPending}
                        onChange={setDiaryRating}
                      />
                    </div>
                  </div>
                )}
              </div>

              {!user && (
                <p className="mt-2 text-[11px] text-mn-text-muted">
                  Sign in to see your diary status and ratings for this title.
                </p>
              )}
            </div>

            {user &&
              !friendsReactionsLoading &&
              friendsReactions &&
              friendsReactions.length > 0 && (
                <div className="rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-3 text-[12px] text-mn-text-secondary">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-mn-text-primary">Friends who liked this</p>
                      <p className="mt-0.5 text-[11.5px] text-mn-text-muted">
                        See which friends have rated this title and how they felt about it.
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    {friendsReactions.slice(0, 4).map((friend) => {
                      const label =
                        friend.displayName ?? (friend.username ? `@${friend.username}` : "Friend");
                      return (
                        <div
                          key={friend.userId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-mn-border-subtle/60 bg-mn-bg/80 px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mn-bg-elevated text-[11px] font-semibold text-mn-text-primary">
                              {friend.avatarUrl ? (
                                <img
                                  src={friend.avatarUrl}
                                  alt={label ?? "Friend avatar"}
                                  className="h-7 w-7 rounded-full object-cover"
                                />
                              ) : (
                                (label ?? "?")[0]?.toUpperCase()
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11.5px] font-medium text-mn-text-primary">
                                {label}
                              </span>
                              {friend.rating != null && (
                                <span className="text-[11px] text-mn-text-muted">
                                  Rated {friend.rating}/10
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Link
                              to={friend.username ? `/u/${friend.username}` : `/u/${friend.userId}`}
                              className="text-[11px] font-medium text-mn-primary underline"
                            >
                              View profile
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleStartConversation(friend.userId)}
                              disabled={startingConversationFor === friend.userId}
                              className="text-[11px] font-medium text-mn-primary/90 underline disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {startingConversationFor === friend.userId ? "Starting…" : "Message"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
        </div>
      </PageSection>
    </div>
  );
};

export default TitleDetailPage;
