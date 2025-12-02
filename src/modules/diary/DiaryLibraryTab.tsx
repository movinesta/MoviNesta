import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Film, ListFilter, Star } from "lucide-react";
import type { TitleType } from "../search/useSearchTitles";
import { useDiaryLibrary, useDiaryLibraryMutations, type DiaryStatus } from "./useDiaryLibrary";
import { diaryStatusLabel, diaryStatusPillClasses } from "./diaryStatus";

interface DiaryLibraryTabProps {
  userId?: string | null;
  isOwnProfile?: boolean;
  displayName?: string | null;
  username?: string | null;
}

type StatusFilter = DiaryStatus | "all";
type TypeFilter = TitleType | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "want_to_watch", label: "Want to Watch" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
  { value: "dropped", label: "Dropped" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
];



const DiaryLibraryTab: React.FC<DiaryLibraryTabProps> = ({
  userId,
  isOwnProfile = false,
  displayName,
  username,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { entries, isLoading, isError, error } = useDiaryLibrary(
    {
      status: statusFilter === "all" ? undefined : (statusFilter as DiaryStatus),
      type: typeFilter === "all" ? undefined : (typeFilter as TitleType),
    },
    userId,
  );

  const { updateStatus, updateRating } = useDiaryLibraryMutations();

  const isMutating = updateStatus.isPending || updateRating.isPending;

  const canEdit = isOwnProfile;
  const nameLabel = displayName || (username ? `@${username}` : "this user");

  if (isLoading) {
    return (
      <div className="px-2 pb-4">
        <div className="mb-3 flex items-center justify-between gap-2 px-1 text-[11px] text-mn-text-secondary">
          <div className="flex items-center gap-1.5">
            <ListFilter className="h-3.5 w-3.5" />
            <span>
              {isOwnProfile ? "Loading your library…" : `Loading ${nameLabel}\u2019s library…`}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-mn-card border border-mn-border-subtle/60 bg-mn-bg-elevated/80 shadow-mn-card"
            >
              <div className="h-40 w-full bg-mn-bg/70" />
              <div className="space-y-1.5 p-2.5">
                <div className="h-3 w-3/4 rounded bg-mn-bg/70" />
                <div className="h-2.5 w-1/2 rounded bg-mn-bg/80" />
                <div className="h-2.5 w-2/3 rounded bg-mn-bg/80" />
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
        <div className="max-w-sm rounded-mn-card border border-mn-error/40 bg-mn-error/5 p-4 text-center text-[11px] text-mn-text-primary shadow-mn-card">
          <p className="font-semibold">Unable to load {isOwnProfile ? "your" : "their"} library.</p>
          <p className="mt-1 text-[10px] text-mn-text-secondary">
            {error ?? "Please try again in a moment."}
          </p>
        </div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 p-5 text-center text-[11px] text-mn-text-secondary shadow-mn-card">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-mn-primary/15">
            <Film className="h-5 w-5 text-mn-primary" aria-hidden="true" />
          </div>
          <p className="font-heading text-sm font-semibold text-mn-text-primary">
            {isOwnProfile ? "Your library is empty" : `${nameLabel}'s library is empty`}
          </p>
          <p className="mt-1 text-[11px]">
            {isOwnProfile
              ? "As you add titles to your Watchlist and mark them as watched, this tab will turn into a sortable diary of everything you’ve seen."
              : "When they add titles to their Watchlist or mark them watched, you’ll be able to browse their picks here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-4">
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((option) => {
            const isActive = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
                  isActive
                    ? "border-mn-primary/60 bg-mn-primary-soft text-mn-text-primary shadow-sm"
                    : "border-mn-border-subtle bg-mn-bg-elevated/80 text-mn-text-secondary hover:border-mn-border-subtle/80 hover:text-mn-text-primary"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <ListFilter className="h-3.5 w-3.5 text-mn-text-muted" aria-hidden="true" />
          <label className="flex items-center gap-1 text-[10px] text-mn-text-secondary">
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 px-2 py-1 text-[10px] text-mn-text-primary"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-sm text-mn-text-muted">
            <p className="font-medium text-mn-text-primary">
              {isOwnProfile ? "Your diary is empty" : "No diary entries yet"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-mn-text-muted">
              {isOwnProfile
                ? "Start by searching for a movie or show and adding it to your diary."
                : "When they start logging what they watch, it will show up here."}
            </p>
            {isOwnProfile && (
              <Link
                to="/search"
                className="mt-4 inline-flex items-center rounded-full bg-mn-primary px-4 py-1.5 text-xs font-medium text-mn-bg shadow-sm hover:bg-mn-primary/90"
              >
                Search titles
              </Link>
            )}
          </div>
        ) : (
          entries.map((entry) => {
          const handleStatusCycle = () => {
            if (!canEdit) return;
            const order: DiaryStatus[] = ["want_to_watch", "watching", "watched", "dropped"];
            const idx = order.indexOf(entry.status);
            const next = order[(idx + 1) % order.length];
            updateStatus.mutate({ titleId: entry.titleId, status: next, type: entry.type });
          };

          const handleStarClick = (value: number) => {
            if (!canEdit) return;
            const nextRating = entry.rating === value ? null : value;
            updateRating.mutate({
              titleId: entry.titleId,
              rating: nextRating,
              type: entry.type,
            });
          };

          const titleUrl = `/title/${entry.titleId}`;

          return (
            <article
              key={entry.id}
              className="group flex flex-col overflow-hidden rounded-mn-card border border-mn-border-subtle/60 bg-mn-bg-elevated/80 shadow-mn-card"
            >
              <Link to={titleUrl} className="relative block">
                <div className="aspect-[2/3] w-full overflow-hidden bg-mn-bg/80">
                  {entry.posterUrl ? (
                    <img
                      src={entry.posterUrl}
                      alt={entry.title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-mn-text-muted">
                      <Film className="mr-1 h-4 w-4" />
                      No poster
                    </div>
                  )}
                </div>
              </Link>

              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <div className="min-h-[2.4rem]">
                  <Link
                    to={titleUrl}
                    className="line-clamp-2 text-[13px] font-medium text-mn-text-primary hover:underline"
                  >
                    {entry.title}
                  </Link>
                  {entry.year && (
                    <p className="text-[10px] text-mn-text-secondary">({entry.year})</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={handleStatusCycle}
                    disabled={isMutating || !canEdit}
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium transition ${diaryStatusPillClasses(
                      entry.status ?? null,
                    )} ${
                      isMutating
                        ? "opacity-70"
                        : canEdit
                          ? "hover:border-mn-primary/70 hover:bg-mn-primary-soft"
                          : "opacity-80"
                    }`}
                  >
                    {diaryStatusLabel(entry.status ?? null)}
                  </button>

                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const value = idx + 1;
                        const isFilled = (entry.rating ?? 0) >= value;
                        return (
                          <button
                            key={idx}
                            type="button"
                            className="p-0.5"
                            disabled={isMutating || !canEdit}
                            onClick={() => handleStarClick(value)}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${
                                isFilled ? "fill-yellow-400 text-yellow-300" : "text-mn-text-muted"
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-mn-text-muted">
                      {entry.rating != null ? `${entry.rating}/5` : "No rating"}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })
        )}
      </div>
    </div>
  );
};

export default DiaryLibraryTab;
