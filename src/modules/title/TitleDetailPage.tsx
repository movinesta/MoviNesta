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
import { ExternalRatingsChips } from "./ExternalRatingsChips";
import TopBar from "../../components/shared/TopBar";
import { supabase } from "../../lib/supabase";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { tmdbImageUrl } from "@/lib/tmdb";
import type { SwipeCardData } from "../swipe/useSwipeDeck";
import { fetchMediaSwipeDeck, getOrCreateMediaSwipeSessionId } from "../swipe/mediaSwipeApi";
import { mapMediaItemToSummary, type MediaItemRow } from "@/lib/mediaItems";

type TitleRow = MediaItemRow;

const MEDIA_ITEM_DETAIL_COLUMNS = `
  id,
  kind,
  tmdb_title,
  tmdb_name,
  tmdb_original_title,
  tmdb_original_name,
  tmdb_release_date,
  tmdb_first_air_date,
  tmdb_runtime,
  tmdb_overview,
  tmdb_tagline,
  tmdb_backdrop_path,
  tmdb_poster_path,
  tmdb_original_language,
  tmdb_origin_country,
  tmdb_genres,
  omdb_title,
  omdb_plot,
  omdb_director,
  omdb_actors,
  omdb_language,
  omdb_country,
  omdb_imdb_rating,
  omdb_imdb_votes,
  omdb_metascore,
  omdb_rating_rotten_tomatoes,
  omdb_year,
  omdb_poster,
  omdb_rated,
  omdb_genre
`;

const parseRottenTomatoes = (value?: string | null): number | null => {
  if (!value) return null;
  const match = String(value).match(/(\d{1,3})/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
};

const parseOptionalNumber = (value?: string | number | null): number | null => {
  if (value == null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  code?: string;
}

const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();
  const navigate = useNavigate();
  const [startingConversationFor, setStartingConversationFor] = React.useState<string | null>(null);
  const swipeSessionId = React.useMemo(() => getOrCreateMediaSwipeSessionId(), []);

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

      // 1. Try fetching from Supabase (if it exists in our DB)
      const { data, error } = await supabase
        .from("media_items")
        .select(MEDIA_ITEM_DETAIL_COLUMNS)
        .eq("id", titleId)
        .maybeSingle();

      if (data) {
        return data as TitleRow;
      }

      // 2. If not found in DB, check if it's a TMDB ID (e.g. "tmdb-12345" or just "12345" if valid?)
      // The search logic likely constructs IDs like "tmdb-MOVIEID" or "tv-SERIESID".
      // We'll try to parse it.
      let tmdbId: number | null = null;
      let mediaType: "movie" | "tv" | "person" = "movie";

      if (titleId.startsWith("tmdb-")) {
        tmdbId = Number(titleId.replace("tmdb-", ""));
        mediaType = "movie";
      } else if (titleId.startsWith("tv-")) {
        tmdbId = Number(titleId.replace("tv-", ""));
        mediaType = "tv";
      } else if (!isNaN(Number(titleId))) {
        // Fallback: assume bare number is a movie ID (or handle ambiguity?)
        // Ideally we shouldn't guess, but for robustness:
        tmdbId = Number(titleId);
      }

      if (!tmdbId) {
        // Not a valid ID format we can fetch, and not in DB.
        if (error) throw error;
        return null;
      }

      // 3. Fetch from TMDB directly
      try {
        // Dynamic import or usage of fetchTmdbJson
        // We need to import fetchTmdbJson at top of file, assuming it's available.
        const details = await import("@/lib/tmdb").then(m => m.fetchTmdbJson(
          `/${mediaType}/${tmdbId}`,
          { append_to_response: "credits,videos,external_ids" }
        ));

        if (!details) return null;

        const d = details as any;

        // Map TMDB response to TitleRow (MediaItemRow)
        // We construct a "virtual" row.
        const row: TitleRow = {
          id: titleId, // keep the virtual ID
          kind: mediaType === "tv" ? "series" : "movie",
          tmdb_id: tmdbId,
          tmdb_title: d.title ?? d.name,
          tmdb_original_title: d.original_title ?? d.original_name,
          tmdb_overview: d.overview,
          tmdb_poster_path: d.poster_path,
          tmdb_backdrop_path: d.backdrop_path,
          tmdb_release_date: d.release_date ?? d.first_air_date,
          tmdb_first_air_date: d.first_air_date,
          tmdb_vote_average: d.vote_average,
          tmdb_vote_count: d.vote_count,
          tmdb_popularity: d.popularity,
          tmdb_genres: d.genres, // [{id, name}]
          tmdb_runtime: d.runtime ?? (d.episode_run_time?.[0] || null),
          tmdb_tagline: d.tagline,
          tmdb_origin_country: d.origin_country,
          tmdb_original_language: d.original_language,
          // OMDB fields will be empty/null, that's fine
          omdb_imdb_id: d.external_ids?.imdb_id ?? null,
          omdb_imdb_rating: null,
          omdb_metascore: null,
          omdb_rated: null,
          omdb_rating_rotten_tomatoes: null,
          omdb_year: (d.release_date ?? d.first_air_date)?.substring(0, 4) ?? null,
          omdb_plot: null,
          omdb_director: d.credits?.crew?.find((c: any) => c.job === "Director")?.name ?? null,
          omdb_actors: d.credits?.cast?.slice(0, 4).map((c: any) => c.name).join(", ") ?? null,
          created_at: new Date().toISOString(), // fake
          updated_at: new Date().toISOString(),
        } as any;

        return row;
      } catch (err) {
        console.error("Failed to fetch TMDB fallback", err);
        if (error) throw error;
        return null; // genuinely not found
      }
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
      // Note: If titleId is virtual (tmdb-123), we won't find ratings in DB linked to it yet.
      // So if (titleId.startsWith('tmdb-') || titleId.startsWith('tv-')) return [];

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
        .from("profiles_public" as any)
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

  const { data: moreLikeThisCards, isLoading: moreLikeThisLoading } = useQuery<SwipeCardData[]>({
    queryKey: qk.moreLikeThis(titleId),
    enabled: Boolean(titleId),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      if (!titleId) return [];
      try {
        const { cards } = await fetchMediaSwipeDeck(
          {
            sessionId: swipeSessionId,
            mode: "combined",
            limit: 18,
            seed: titleId,
          },
          { timeoutMs: 20000 },
        );

        return (cards ?? [])
          .map((card) => ({
            id: String(card.mediaItemId),
            title: (card.title ?? "Untitled").trim() || "Untitled",
            year: card.releaseYear ?? null,
            tmdbPosterPath: card.tmdbPosterPath ?? null,
            posterUrl: card.posterUrl ?? null,
            source: null,
          }))
          .filter((card) => Boolean(card.id && card.title));
      } catch (err) {
        console.warn("[TitleDetailPage] more-like-this failed", err);
        return [];
      }
    },
  });

  const summary = data ? mapMediaItemToSummary(data) : null;
  const displayTitle = summary?.title ?? "Untitled";
  const derivedYear = summary?.year ?? null;
  const normalizedContentType = summary?.type ?? null;

  const posterImage = summary?.posterUrl ?? null;
  const backdropImage = summary?.backdropUrl ?? null;
  const runtimeMinutes = parseOptionalNumber(data?.tmdb_runtime as any);

  const tmdbGenresRaw = data?.tmdb_genres;
  const genres: string[] = Array.isArray(tmdbGenresRaw)
    ? tmdbGenresRaw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const name = (item as Record<string, unknown>).name;
        return typeof name === "string" && name.trim() ? name.trim() : null;
      })
      .filter((value): value is string => Boolean(value))
    : typeof data?.omdb_genre === "string"
      ? data.omdb_genre
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
      : [];

  const primaryLanguage = summary?.originalLanguage ?? null;
  const primaryCountry =
    Array.isArray(data?.tmdb_origin_country) && data.tmdb_origin_country.length
      ? data.tmdb_origin_country[0]
      : (data?.omdb_country ?? null);

  const overview = data?.omdb_plot ?? data?.tmdb_overview ?? null;
  const tagline = data?.tmdb_tagline ?? null;
  const externalImdbRating = parseOptionalNumber(data?.omdb_imdb_rating as any);
  const externalMetascore = parseOptionalNumber(data?.omdb_metascore as any);
  const externalTomato = parseRottenTomatoes(data?.omdb_rating_rotten_tomatoes);

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
        <TopBar title="Title details" />

        <PageSection>
          <p className="text-sm text-muted-foreground">
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
            <div className="h-40 w-28 animate-pulse rounded-2xl bg-card/60 sm:h-52 sm:w-36" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="space-y-1.5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-card/60" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-card/40" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full animate-pulse rounded bg-card/40" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-card/30" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-card/30" />
              </div>
              <div className="mt-2 flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-card/50" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-card/40" />
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
          <p className="text-sm text-muted-foreground">We couldn&apos;t find that title.</p>
          <Link to="/search" className="mt-3 inline-block text-sm text-primary underline">
            Back to search
          </Link>
        </PageSection>
      </div>
    );
  }
  const runtimeLabel =
    typeof runtimeMinutes === "number" && runtimeMinutes > 0
      ? `${Math.floor(runtimeMinutes / 60)}h ${runtimeMinutes % 60 ? `${runtimeMinutes % 60}m` : ""}`.trim()
      : null;

  const displayContentType =
    normalizedContentType === "movie"
      ? "Movie"
      : normalizedContentType === "series"
        ? "TV Series"
        : normalizedContentType === "anime"
          ? "Anime"
          : (data?.kind ?? null);

  const moreLikeCards = moreLikeThisCards ?? [];

  const metaPieces: string[] = [];
  if (derivedYear) metaPieces.push(String(derivedYear));
  if (displayContentType) metaPieces.push(displayContentType);
  if (runtimeLabel) metaPieces.push(runtimeLabel);
  if (primaryCountry) metaPieces.push(primaryCountry);
  if (primaryLanguage) metaPieces.push(primaryLanguage);

  const ensureSignedIn = () => {
    if (!user) {
      alert("Sign in to save this title to your diary or leave a rating.");
      return false;
    }
    return true;
  };

  const setDiaryStatus = (status: DiaryStatus) => {
    if (!ensureSignedIn() || updateStatus.isPending) return;
    if (!normalizedContentType) {
      alert("We couldn't determine the content type for this title yet.");
      return;
    }

    updateStatus.mutate({ titleId: data.id, status, type: normalizedContentType });
  };

  const setDiaryRating = (nextRating: number | null) => {
    if (!ensureSignedIn() || updateRating.isPending) return;
    if (!normalizedContentType) {
      alert("We couldn't determine the content type for this title yet.");
      return;
    }

    updateRating.mutate({
      titleId: data.id,
      rating: nextRating,
      type: normalizedContentType,
    });
  };

  const metaLine = metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details";

  const statusIs = (status: DiaryStatus) => diaryEntry?.status === status;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      <TopBar title={displayTitle} />

      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/80 shadow-md">
        <div className="absolute inset-0">
          {backdropImage ? (
            <img
              src={backdropImage}
              alt={displayTitle}
              className="h-full w-full scale-105 object-cover blur-[1px]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-background via-background/70 to-card" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        </div>

        <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-end">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {posterImage ? (
              <img
                src={posterImage}
                alt={displayTitle}
                className="aspect-[2/3] w-full rounded-2xl object-cover shadow-lg"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-2xl border border-dashed border-border bg-background/70 text-xs text-muted-foreground">
                No poster available
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {displayContentType ?? "Title"}
              </p>
              <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{displayTitle}</h1>
              <p className="text-[12.5px] text-muted-foreground">{metaLine}</p>
            </div>

            {overview && (
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-[14px]">
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
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${statusIs("want_to_watch")
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/60 hover:text-primary"
                  }`}
              >
                Add to watchlist
              </button>
              <button
                type="button"
                onClick={() => setDiaryStatus("watching")}
                disabled={updateStatus.isPending}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${statusIs("watching")
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/60 hover:text-primary"
                  }`}
              >
                I’m watching
              </button>
              <button
                type="button"
                onClick={() => setDiaryStatus("watched")}
                disabled={updateStatus.isPending}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11.5px] font-semibold transition ${statusIs("watched")
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/60 hover:text-primary"
                  }`}
              >
                Log as watched
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground">Your rating</span>
              <RatingStars
                value={diaryEntry?.rating ?? null}
                disabled={updateRating.isPending}
                onChange={setDiaryRating}
              />
              {diaryEntry?.rating != null && (
                <span className="text-xs text-muted-foreground">{diaryEntry.rating}/10</span>
              )}
            </div>

            {!user && (
              <p className="text-[11.5px] text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary underline">
                  Sign in
                </Link>{" "}
                to log this title, rate it, or add it to your watchlist.
              </p>
            )}
          </div>
        </div>
      </div>

      <PageSection>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">More like this</h2>
          {moreLikeThisLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>

        {moreLikeThisLoading ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-40 w-28 flex-shrink-0 animate-pulse rounded-xl border border-border bg-card/70"
              />
            ))}
          </div>
        ) : moreLikeCards.length > 0 ? (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {moreLikeCards.map((card) => {
              const posterSrc =
                card.posterUrl ??
                (card.tmdbPosterPath ? tmdbImageUrl(card.tmdbPosterPath, "w342") : null);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => navigate(`/title/${card.id}`)}
                  className="flex w-28 flex-shrink-0 flex-col gap-1 text-left"
                >
                  <div className="aspect-[2/3] w-28 overflow-hidden rounded-xl border border-border bg-card/80">
                    {posterSrc ? (
                      <img
                        src={posterSrc}
                        alt={card.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground">
                        No poster
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 text-[12px] text-foreground">{card.title}</span>
                  {card.year && (
                    <span className="text-[11px] text-muted-foreground">{card.year}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No similar titles yet.</p>
        )}
      </PageSection>

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            <div className="rounded-2xl border border-border bg-background/80 px-3 py-3 text-[12px] text-muted-foreground">
              {tagline && <p className="text-sm font-medium text-foreground">{tagline}</p>}
              {overview && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {overview}
                </p>
              )}
              {!tagline && !overview && (
                <p className="text-[12px] text-muted-foreground">
                  We don&apos;t have a plot summary for this title yet.
                </p>
              )}
              {genres && genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {genres.slice(0, 6).map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-border px-2 py-[2px] text-xs text-muted-foreground"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {(data.omdb_director || data.omdb_actors) && (
                <div className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
                  {data.omdb_director && (
                    <p>
                      <span className="font-semibold text-foreground">Director:</span>{" "}
                      {data.omdb_director}
                    </p>
                  )}
                  {data.omdb_actors && (
                    <p>
                      <span className="font-semibold text-foreground">Cast:</span>{" "}
                      {data.omdb_actors}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card/80 px-3 py-3 text-[12px] text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">Your diary</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Keep this title synced with the same diary data used across MoviNesta.
                  </p>
                </div>

                {user && (
                  <div className="flex flex-col items-end gap-2 text-xs">
                    <span className={diaryStatusPillClasses(diaryEntry?.status)}>
                      {diaryStatusLabel(diaryEntry?.status)}
                    </span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground">Rating</span>
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
                <p className="mt-2 text-xs text-muted-foreground">
                  Sign in to see your diary status and ratings for this title.
                </p>
              )}
            </div>

            {user &&
              !friendsReactionsLoading &&
              friendsReactions &&
              friendsReactions.length > 0 && (
                <div className="rounded-2xl border border-border bg-card/80 px-3 py-3 text-[12px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">Friends who liked this</p>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
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
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/80 px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card text-xs font-semibold text-foreground">
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
                              <span className="text-[11.5px] font-medium text-foreground">
                                {label}
                              </span>
                              {friend.rating != null && (
                                <span className="text-xs text-muted-foreground">
                                  Rated {friend.rating}/10
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Link
                              to={friend.username ? `/u/${friend.username}` : `/u/${friend.userId}`}
                              className="text-xs font-medium text-primary underline"
                            >
                              View profile
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleStartConversation(friend.userId)}
                              disabled={startingConversationFor === friend.userId}
                              className="text-xs font-medium text-primary/90 underline disabled:cursor-not-allowed disabled:opacity-60"
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
