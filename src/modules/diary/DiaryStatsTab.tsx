import React from "react";
import { BarChart3, Film, PieChart, Sparkles } from "lucide-react";
import { useDiaryStats } from "./useDiaryStats";
import { formatDate } from "@/utils/format";

const formatMonthLabel = (monthKey: string): string => {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  return formatDate(date, { month: "short", year: "numeric" });
};

const DiaryStatsTab: React.FC = () => {
  const { stats, isLoading, isError, error } = useDiaryStats();

  if (isLoading) {
    return (
      <div className="px-2 pb-4">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg"
            >
              <div className="mb-2 h-3 w-1/3 rounded bg-background/70" />
              <div className="flex gap-1.5">
                {Array.from({ length: 6 }).map((__, jdx) => (
                  <div key={jdx} className="h-10 flex-1 rounded bg-background/70" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center text-xs text-foreground shadow-lg">
          <p className="font-semibold">Unable to load your stats.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error ?? "Please try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  if (
    stats.totalRated === 0 &&
    stats.totalWatched === 0 &&
    !stats.ratingDistribution.length &&
    !stats.topGenres.length &&
    !stats.watchCountByMonth.length
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-border bg-card/80 p-5 text-center text-xs text-muted-foreground shadow-lg">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <p className="font-heading text-sm font-semibold text-foreground">No stats yet</p>
          <p className="mt-1 text-xs">
            Once you start rating titles and marking them as watched, you&apos;ll see your rating
            distribution, top genres, and watch streaks here.
          </p>
        </div>
      </div>
    );
  }

  const maxRatingBucket = stats.ratingDistribution.reduce(
    (max, b) => (b.count > max ? b.count : max),
    0,
  );
  const maxWatchCount = stats.watchCountByMonth.reduce(
    (max, p) => (p.count > max ? p.count : max),
    0,
  );
  const topGenres = stats.topGenres.slice(0, 6);

  return (
    <div className="space-y-3 px-2 pb-4">
      {/* Overview */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Watched</span>
            <Film className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">{stats.totalWatched}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Titles marked as <span className="font-medium text-foreground">Watched</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Rated</span>
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">{stats.totalRated}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ratings you&apos;ve logged across movies, series, and anime.
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-border bg-card/80 p-3 text-xs text-muted-foreground shadow-lg sm:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Average rating</span>
            <PieChart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {stats.averageRating != null ? stats.averageRating.toFixed(1) : "–"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Quick glance at how generous you typically are with stars.
          </p>
        </div>
      </section>

      {/* Rating distribution */}
      <section className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-foreground">Rating distribution</h2>
          <span className="text-xs text-muted-foreground">
            0.5 – 5.0 &bull; {stats.totalRated} ratings
          </span>
        </div>
        {stats.ratingDistribution.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Once you start rating titles, you&apos;ll see how your scores cluster here.
          </p>
        ) : (
          <div className="flex items-end gap-1.5">
            {stats.ratingDistribution.map((bucket) => {
              const height =
                maxRatingBucket > 0 ? Math.max((bucket.count / maxRatingBucket) * 52, 6) : 6;
              return (
                <div key={bucket.rating} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/25"
                    style={{ height }}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {bucket.rating.toFixed(1)}★
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Top genres */}
      <section className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-foreground">Top genres</h2>
          <span className="text-xs text-muted-foreground">
            Based on titles you&apos;ve marked as watched
          </span>
        </div>
        {!topGenres.length ? (
          <p className="text-xs text-muted-foreground">
            Watch and rate a few titles to reveal your go-to genres.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topGenres.map((genre) => (
              <span
                key={genre.genre}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                <span className="font-medium">{genre.genre}</span>
                <span className="text-[9px] text-muted-foreground">×{genre.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Watch count over time */}
      <section className="rounded-2xl border border-border bg-card/80 p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-foreground">Watch count over time</h2>
          <span className="text-xs text-muted-foreground">
            Month by month, based on your library
          </span>
        </div>
        {!stats.watchCountByMonth.length ? (
          <p className="text-xs text-muted-foreground">
            As you mark titles as watched, you&apos;ll see your movie-watching streaks here.
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-end gap-1.5">
              {stats.watchCountByMonth.map((point) => {
                const height =
                  maxWatchCount > 0 ? Math.max((point.count / maxWatchCount) * 52, 6) : 6;
                return (
                  <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/20"
                      style={{ height }}
                      aria-hidden="true"
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {formatMonthLabel(point.month)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default DiaryStatsTab;
