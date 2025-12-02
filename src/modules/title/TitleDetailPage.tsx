import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RatingStars } from "../../components/RatingStars";
import { useQuery } from "@tanstack/react-query";
import { qk } from "../../lib/queryKeys";
import { useAuth } from "../auth/AuthProvider";
import { useDiaryLibraryMutations, type DiaryStatus } from "../diary/useDiaryLibrary";
import { diaryStatusLabel, diaryStatusPillClasses } from "../diary/diaryStatus";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { supabase } from "../../lib/supabase";

interface TitleRow {
  id: string;

  // Core identity
  content_type: string | null;
  primary_title: string | null;
  original_title: string | null;
  sort_title: string | null;
  omdb_title: string | null;
  tmdb_title: string | null;

  // Dates & runtime
  release_year: number | null;
  release_date: string | null;
  runtime_minutes: number | null;
  omdb_runtime_minutes: number | null;
  tmdb_runtime: number | null;
  tmdb_episode_run_time: number[] | null;

  // Story / description
  plot: string | null;
  tmdb_overview: string | null;
  omdb_plot: string | null;
  tagline: string | null;

  // People
  omdb_director: string | null;
  omdb_actors: string | null;

  // Genres & locale
  genres: string[] | null;
  omdb_genre_names: string[] | null;
  tmdb_genre_names: string[] | null;
  language: string | null;
  omdb_language: string | null;
  tmdb_original_language: string | null;
  country: string | null;
  omdb_country: string | null;

  // Ratings
  imdb_rating: number | null;
  omdb_imdb_rating: number | null;
  imdb_votes: number | null;
  omdb_imdb_votes: number | null;
  metascore: number | null;
  omdb_metacritic_score: number | null;
  omdb_rt_rating_pct: number | null;
  rt_tomato_pct: number | null;

  // Artwork
  poster_url: string | null;
  omdb_poster_url: string | null;
  tmdb_poster_path: string | null;
  backdrop_url: string | null;
  tmdb_backdrop_path: string | null;

  // Trailer
  youtube_trailer_url: string | null;
  youtube_trailer_video_id: string | null;
  youtube_trailer_title: string | null;
}

interface CreateDirectConversationResponse {
  ok: boolean;
  conversationId?: string;
  error?: string;
  errorCode?: string;
}


type RatingsProps = {
  imdb_rating: number | null;
  omdb_rt_rating_pct: number | null;
  metascore: number | null;
};

const ExternalRatingsChips: React.FC<RatingsProps> = ({
  imdb_rating,
  omdb_rt_rating_pct,
  metascore,
}) => {
  const hasAnyRating =
    (typeof imdb_rating === "number" && imdb_rating > 0) ||
    (typeof omdb_rt_rating_pct === "number" && omdb_rt_rating_pct > 0) ||
    (typeof metascore === "number" && metascore > 0);

  if (!hasAnyRating) return null;

  const hasImdbRating =
    typeof imdb_rating === "number" && !Number.isNaN(imdb_rating) && imdb_rating > 0;
  const hasTomatometer =
    typeof omdb_rt_rating_pct === "number" &&
    !Number.isNaN(omdb_rt_rating_pct) &&
    omdb_rt_rating_pct > 0;
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
          {omdb_rt_rating_pct}%
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
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25000);

      try {
        const { data, error } = await supabase.functions.invoke<CreateDirectConversationResponse>(
          "create-direct-conversation",
          {
            body: { targetUserId },
            signal: controller.signal,
          },
        );

        if (error) {
          console.error("[TitleDetailPage] create-direct-conversation error", error);
          throw new Error(error.message ?? "Failed to start conversation.");
        }

        const payload = data as CreateDirectConversationResponse | null;

        if (!payload?.ok || !payload.conversationId) {
          const code = payload?.errorCode;
          let friendly =
            payload?.error ?? "Failed to get conversation id. Please try again.";

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
      } finally {
        window.clearTimeout(timeout);
      }
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
    queryFn: async () => {
      if (!titleId) return null;

      const { data, error } = await supabase
        .from("titles")
        .select(
          `
          id:title_id,
          content_type,
          primary_title,
          original_title,
          sort_title,
          omdb_title,
          tmdb_title,
          release_year,
          release_date,
          runtime_minutes,
          omdb_runtime_minutes,
          tmdb_runtime,
          tmdb_episode_run_time,
          plot,
          tmdb_overview,
          omdb_plot,
          tagline,
          omdb_director,
          omdb_actors,
          genres,
          omdb_genre_names,
          tmdb_genre_names,
          language,
          omdb_language,
          tmdb_original_language,
          country,
          omdb_country,
          imdb_rating,
          omdb_imdb_rating,
          imdb_votes,
          omdb_imdb_votes,
          metascore,
          omdb_metacritic_score,
          omdb_rt_rating_pct,
          rt_tomato_pct,
          poster_url,
          omdb_poster_url,
          tmdb_poster_path,
          backdrop_url,
          tmdb_backdrop_path,
          youtube_trailer_url,
          youtube_trailer_video_id,
          youtube_trailer_title
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

  const {
    data: diaryEntry,
    isLoading: diaryEntryLoading,
  } = useQuery<{ status: DiaryStatus | null; rating: number | null }>({
    queryKey: qk.titleDiary(user?.id, titleId),
    enabled: Boolean(user?.id && titleId),
    queryFn: async () => {
      if (!user?.id || !titleId) {
        return { status: null, rating: null };
      }

      const userId = user.id;

      const [
        { data: libraryRow, error: libraryError },
        { data: ratingRow, error: ratingError },
      ] = await Promise.all([
        supabase
          .from("library_entries")
          .select("status")
          .eq("user_id", userId)
          .eq("title_id", titleId)
          .maybeSingle(),
        supabase
          .from("ratings")
          .select("rating")
          .eq("user_id", userId)
          .eq("title_id", titleId)
          .maybeSingle(),
      ]);

      if (libraryError && (libraryError as any).code !== "PGRST116") {
        throw libraryError;
      }
      if (ratingError && (ratingError as any).code !== "PGRST116") {
        throw ratingError;
      }

      return {
        status: (libraryRow?.status as DiaryStatus | null) ?? null,
        rating: (ratingRow?.rating as number | null) ?? null,
      };
    },
  });
  const {
    data: friendsReactions,
    isLoading: friendsReactionsLoading,
  } = useQuery<
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
    queryFn: async () => {
      if (!user?.id || !titleId) return [];

      const userId = user.id;

      // 1) Find people the current user follows.
      const { data: follows, error: followsError } = await supabase
        .from("follows")
        .select("followed_user_id")
        .eq("follower_user_id", userId)
        .limit(80);

      if (followsError) {
        throw followsError;
      }

      const friendIds = (follows ?? []).map((row: any) => row.followed_user_id as string).filter(Boolean);

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

  const displayTitle =
    data.primary_title ??
    data.omdb_title ??
    data.tmdb_title ??
    data.original_title ??
    "Untitled";

  const derivedYear =
    data.release_year ?? (data.release_date ? new Date(data.release_date).getFullYear() : null);

  const runtimeMinutes =
    data.runtime_minutes ??
    data.omdb_runtime_minutes ??
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
      : data.content_type === "tv"
      ? "TV Series"
      : data.content_type ?? null;

  const primaryLanguage =
    data.language ?? data.omdb_language ?? data.tmdb_original_language ?? null;

  const primaryCountry = data.country ?? data.omdb_country ?? null;

  const genres =
    (data.genres && data.genres.length > 0 && data.genres) ||
    (data.tmdb_genre_names && data.tmdb_genre_names.length > 0 && data.tmdb_genre_names) ||
    (data.omdb_genre_names && data.omdb_genre_names.length > 0 && data.omdb_genre_names) ||
    [];

  const overview = data.plot ?? data.tmdb_overview ?? data.omdb_plot ?? null;

  const posterImage =
    data.poster_url ??
    data.omdb_poster_url ??
    (data.tmdb_poster_path ? `https://image.tmdb.org/t/p/w500${data.tmdb_poster_path}` : null);

  const backdropImage =
    data.backdrop_url ??
    (data.tmdb_backdrop_path ? `https://image.tmdb.org/t/p/w780${data.tmdb_backdrop_path}` : null);

  const metaPieces: string[] = [];
  if (derivedYear) metaPieces.push(String(derivedYear));
  if (displayContentType) metaPieces.push(displayContentType);
  if (runtimeLabel) metaPieces.push(runtimeLabel);
  if (primaryCountry) metaPieces.push(primaryCountry);
  if (primaryLanguage) metaPieces.push(primaryLanguage);

  const externalImdbRating = data.imdb_rating ?? data.omdb_imdb_rating;
  const externalMetascore = data.metascore ?? data.omdb_metacritic_score;
  const externalTomato = data.omdb_rt_rating_pct ?? data.rt_tomato_pct;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col gap-4 px-3 pb-6 pt-2 sm:px-4 lg:px-6">
      {backdropImage && (
        <div className="relative overflow-hidden rounded-3xl border border-mn-border-subtle bg-mn-bg-elevated/80 shadow-mn-soft">
          <img
            src={backdropImage}
            alt={displayTitle}
            className="h-48 w-full object-cover sm:h-56 md:h-64"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-mn-bg/90 via-mn-bg/30 to-transparent" />
        </div>
      )}

      <TopBar
        title={displayTitle}
        subtitle={metaPieces.length > 0 ? metaPieces.join(" · ") : "Title details"}
      />

      <ExternalRatingsChips
        imdb_rating={externalImdbRating}
        omdb_rt_rating_pct={externalTomato}
        metascore={externalMetascore}
      />

      <PageSection>
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="w-28 flex-shrink-0 sm:w-32 md:w-40">
            {posterImage ? (
              <img
                src={posterImage}
                alt={displayTitle}
                className="aspect-[2/3] w-full rounded-mn-card object-cover shadow-mn-card"
              />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-mn-card border border-dashed border-mn-border-subtle bg-mn-bg/70 text-xs text-mn-text-muted">
                No poster available
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3">

<div className="rounded-2xl border border-mn-border-subtle bg-mn-bg/80 px-3 py-3 text-[12px] text-mn-text-secondary">
  {data.tagline && (
    <p className="text-[13px] font-medium text-mn-text-primary">{data.tagline}</p>
  )}
  {overview && (
    <p className="mt-1 text-[12.5px] leading-relaxed text-mn-text-secondary">{overview}</p>
  )}
  {(!data.tagline && !overview) && (
    <p className="text-[12px] text-mn-text-muted">We don&apos;t have a plot summary for this title yet.</p>
  )}
  {(genres && genres.length > 0) && (
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


            {/* Your diary & rating for this title */}
            <div className="mt-3 rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-3 text-[12px] text-mn-text-secondary">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-mn-text-primary">Your diary & rating</p>
                  <p className="mt-0.5 text-[11.5px] text-mn-text-muted">
                    Track how you feel about this title and keep it in your MoviNesta diary.
                  </p>
                </div>

                {user && (
                  <div className="flex flex-col items-end gap-2">
                    {/* Status chip */}
                    <button
                      type="button"
                      onClick={() => {
                        const order: DiaryStatus[] = ["want_to_watch", "watching", "watched", "dropped"];
                        const current = diaryEntry?.status ?? null;
                        const currentIndex = current ? order.indexOf(current) : -1;
                        const nextStatus = order[(currentIndex + 1 + order.length) % order.length];
                        updateStatus.mutate({ titleId: data.id, status: nextStatus, type: data.content_type as any });
                      }}
                      className="inline-flex items-center rounded-full border border-mn-border-subtle bg-mn-bg px-2.5 py-1 text-[11px] font-medium text-mn-text-primary hover:border-mn-primary/70 hover:text-mn-primary/90 disabled:opacity-60"
                      disabled={updateStatus.isPending}
                    >
                      {(() => {
                        if (diaryEntryLoading) return "Updating…";
                        const status = diaryEntry?.status;
                        return diaryStatusLabel(status);
                      })()}
                    </button>

                    {/* Rating stars */}
                    <RatingStars
                      value={diaryEntry?.rating ?? null}
                      disabled={updateRating.isPending}
                      onChange={(nextRating) => {
                        updateRating.mutate({
                          titleId: data.id,
                          rating: nextRating,
                          type: data.content_type as any,
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              {!user && (
                <p className="mt-2 text-[11px] text-mn-text-muted">
                  <Link to="/auth" className="font-medium text-mn-primary underline">
                    Sign in
                  </Link>{" "}
                  to add this title to your diary and leave a rating.
                </p>
              )}
            </div>

            {/* Friends who liked this title */}
            {user && !friendsReactionsLoading && friendsReactions && friendsReactions.length > 0 && (
              <div className="mt-2 rounded-2xl border border-mn-border-subtle/80 bg-mn-bg-elevated/80 px-3 py-3 text-[12px] text-mn-text-secondary">
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
                      friend.displayName ??
                      (friend.username ? `@${friend.username}` : "Friend");
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