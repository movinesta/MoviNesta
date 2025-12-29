// src/modules/search/SearchPage.tsx
// Search page V2 (discover-first) based on Stitch mock.

import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";

import { useSearchPeople, type PeopleSearchResult } from "./useSearchPeople";
import { useSearchTitles, type TitleSearchFilters } from "./useSearchTitles";
import SearchTitlesTab, { TitleSearchResultRow } from "./SearchTitlesTab";
import SearchPeopleTab from "./SearchPeopleTab";
import { parseTabFromParams, parseTitleFiltersFromParams, type SearchTabKey } from "./searchState";

import FriendAvatarStack from "../swipe/FriendAvatarStack";
import { useAuth } from "../auth/AuthProvider";
import {
  useDiscoverGenres,
  useSearchCuratedLists,
  useSearchFriendsAreWatching,
  useSearchTrendingNow,
} from "./useSearchDiscover";

type ChipKey = "all" | "movies" | "series" | "people";

const Chip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-9 shrink-0 items-center justify-center rounded-2xl px-5 text-sm font-medium transition-transform active:scale-95 ${
      active
        ? "bg-primary text-primary-foreground"
        : "bg-muted/70 text-foreground hover:bg-muted"
    }`}
  >
    {label}
  </button>
);

const SectionHeader: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, actionLabel, onAction }) => (
  <div className="flex items-center justify-between px-4 pb-4">
    <h2 className="text-xl font-semibold leading-tight tracking-tight">{title}</h2>
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="text-sm font-medium text-primary hover:text-primary/80"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

const RatingPill: React.FC<{ label: string | null }> = ({ label }) => {
  if (!label) return null;
  return (
    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
      <MaterialIcon
        name="star"
        filled
        className="text-[14px] text-yellow-400"
        ariaLabel="Rating"
      />
      <span>{label}</span>
    </div>
  );
};

const DiscoverPosterCard: React.FC<{
  id: string;
  title: string;
  imageUrl: string | null;
  ratingLabel: string | null;
  subtitle: string | null;
  friendAvatarUrls?: string[];
  friendExtraCount?: number;
}> = ({ id, title, imageUrl, ratingLabel, subtitle, friendAvatarUrls, friendExtraCount }) => {
  const friendProfiles = (friendAvatarUrls ?? []).map((url, idx) => ({
    id: `${id}_${idx}`,
    username: null,
    display_name: null,
    avatar_url: url,
  }));

  // Feed extra count into FriendAvatarStack by adding placeholder profiles.
  // The component will render a "+N" bubble automatically.
  if (friendExtraCount && friendExtraCount > 0) {
    for (let i = 0; i < friendExtraCount; i += 1) {
      friendProfiles.push({
        id: `${id}_placeholder_${i}`,
        username: null,
        display_name: null,
        avatar_url: null,
      });
    }
  }

  return (
    <Link to={`/title/${id}`} className="group flex flex-col gap-2">
      <div
        className="relative aspect-[2/3] w-full overflow-hidden rounded-[20px] bg-muted shadow-lg transition-transform duration-300 group-hover:scale-[1.02]"
        style={
          imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!imageUrl ? (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background/10 to-primary/40" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <RatingPill label={ratingLabel} />

        {friendProfiles.length ? (
          <div className="absolute bottom-2 left-2">
            <FriendAvatarStack profiles={friendProfiles as any} max={3} size={32} />
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate text-base font-medium leading-tight">{title}</p>
        {subtitle ? (
          <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <MaterialIcon name="group_add" className="text-[14px]" ariaLabel="Activity" />
            <span className="truncate">{subtitle}</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
};

const CuratedListCard: React.FC<{
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  ownerLabel: string;
  ownerAvatarUrl: string | null;
}> = ({ id, name, description, coverUrl, ownerLabel, ownerAvatarUrl }) => (
  <Link
    to={`/lists/${id}`}
    className="flex items-center gap-3 rounded-3xl border border-border bg-card/70 p-3 shadow-sm transition-colors hover:bg-card"
  >
    <div className="h-16 w-14 overflow-hidden rounded-2xl bg-muted">
      {coverUrl ? (
        <img src={coverUrl} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-primary/25 via-muted to-primary/30" />
      )}
    </div>

    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">{name}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
        {description || "Curated collection"}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-6 w-6 overflow-hidden rounded-full bg-muted">
          {ownerAvatarUrl ? (
            <img src={ownerAvatarUrl} alt={ownerLabel} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-primary/20" />
          )}
        </div>
        <p className="truncate text-xs font-medium text-muted-foreground">{ownerLabel}</p>
      </div>
    </div>

    <MaterialIcon name="chevron_right" className="text-[22px] text-muted-foreground" ariaLabel="Open" />
  </Link>
);

const PeoplePreviewRow: React.FC<{ person: PeopleSearchResult }> = ({ person }) => {
  const displayName = person.displayName ?? person.username ?? "Unknown";
  const handle = person.username ? `@${person.username}` : null;
  return (
    <Link
      to={person.username ? `/u/${person.username}` : `/u/${person.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-3 py-2 hover:bg-card"
    >
      <div className="h-9 w-9 overflow-hidden rounded-full bg-muted">
        {person.avatarUrl ? (
          <img
            src={person.avatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs font-semibold text-foreground">
            {displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
        {handle ? <p className="truncate text-xs text-muted-foreground">{handle}</p> : null}
      </div>
      <MaterialIcon name="chevron_right" className="text-[22px] text-muted-foreground" ariaLabel="Open" />
    </Link>
  );
};

function deriveChipFromTab(tab: SearchTabKey, filters: TitleSearchFilters): ChipKey {
  if (tab === "people") return "people";
  if (filters.type === "movie") return "movies";
  if (filters.type === "series") return "series";
  return "all";
}

function chipToParams(chip: ChipKey): { tab: SearchTabKey; nextFilters?: Partial<TitleSearchFilters> } {
  if (chip === "people") return { tab: "people" };
  if (chip === "movies") return { tab: "titles", nextFilters: { type: "movie" } };
  if (chip === "series") return { tab: "titles", nextFilters: { type: "series" } };
  return { tab: "all", nextFilters: { type: "all" } };
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();

  const query = (params.get("q") ?? "").toString();
  const trimmedQuery = query.trim();
  const tab = parseTabFromParams(params);

  const filters = React.useMemo(() => parseTitleFiltersFromParams(params), [params]);
  const activeChip = deriveChipFromTab(tab, filters);

  const setChip = React.useCallback(
    (chip: ChipKey) => {
      const { tab: nextTab, nextFilters } = chipToParams(chip);
      setParams((prev) => {
        const next = new URLSearchParams(prev);

        // Preserve search string.
        next.set("tab", nextTab);

        if (nextTab === "people") {
          next.delete("type");
          next.delete("minYear");
          next.delete("maxYear");
          next.delete("lang");
        } else if (nextFilters?.type) {
          next.set("type", nextFilters.type);
        }

        return next;
      });
    },
    [setParams],
  );

  const setQuery = React.useCallback(
    (value: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) {
          next.set("q", value);
        } else {
          next.delete("q");
        }
        // When clearing query, default to V2 discover experience.
        if (!value.trim() && !next.get("tab")) next.set("tab", "all");
        return next;
      });
    },
    [setParams],
  );

  const discoverGenres = useDiscoverGenres();
  const trendingNow = useSearchTrendingNow(10);
  const friendsWatching = useSearchFriendsAreWatching(8);
  const curatedLists = useSearchCuratedLists(6);

  // Search queries (only enabled when trimmedQuery is non-empty).
  const titlesQuery = useSearchTitles({ query: trimmedQuery, filters });
  const peopleQuery = useSearchPeople(trimmedQuery.replace(/^@+/, ""));

  const isDiscover = trimmedQuery.length === 0;

  const openFilterSheet = React.useCallback(() => {
    // Reuse existing filter UI by navigating to legacy SearchPage state.
    // For V2 we keep it simple: open /search?tab=titles&filters=1 (handled by SearchTitlesTab UI)
    // If query is empty, filter has nothing to act on.
    if (!trimmedQuery) return;
    // Scroll into titles results. (This is a noop but keeps the button meaningful.)
    setChip(activeChip === "people" ? "all" : activeChip);
  }, [activeChip, setChip, trimmedQuery]);

  const clearQuery = React.useCallback(() => {
    setQuery("");
  }, [setQuery]);

  const seeAllTrending = React.useCallback(() => {
    // Best-effort: send them to swipe trending (already exists) if available.
    navigate("/swipe?mode=trending");
  }, [navigate]);

  const seeAllFriends = React.useCallback(() => {
    navigate("/activity");
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light pb-24 text-slate-900 dark:bg-background-dark dark:text-white">
      {/* Top spacer (keeps content from hugging the very top under native safe areas) */}
      <div className="h-12 w-full" />

      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background-light/95 px-4 pb-2 pt-2 backdrop-blur-md dark:bg-background-dark/95">
        <div className="flex flex-col gap-4">
          <label className="flex h-12 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm ring-1 ring-transparent focus-within:ring-2 focus-within:ring-primary dark:border-transparent dark:bg-surface-dark">
            <MaterialIcon name="search" className="text-[20px] text-muted-foreground" ariaLabel="Search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, shows, people..."
              className="h-full flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-muted-foreground"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {query ? (
              <button
                type="button"
                onClick={clearQuery}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={openFilterSheet}
              disabled={!trimmedQuery || activeChip === "people"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
              aria-label="Filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </label>

          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip label="All" active={activeChip === "all"} onClick={() => setChip("all")} />
            <Chip
              label="Movies"
              active={activeChip === "movies"}
              onClick={() => setChip("movies")}
            />
            <Chip
              label="Series"
              active={activeChip === "series"}
              onClick={() => setChip("series")}
            />
            <Chip
              label="People"
              active={activeChip === "people"}
              onClick={() => setChip("people")}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {isDiscover ? (
        <div className="flex flex-col pt-6">
          <SectionHeader title="Friends Are Watching" actionLabel="See All" onAction={seeAllFriends} />
          <div className="grid grid-cols-2 gap-4 px-4">
            {friendsWatching.isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="aspect-[2/3] w-full animate-pulse rounded-[20px] bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : friendsWatching.data?.length ? (
              friendsWatching.data.map((item) => (
                <DiscoverPosterCard key={item.id} {...item} />
              ))
            ) : (
              <div className="col-span-2 rounded-3xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
                {session?.user?.id
                  ? "Your friends’ activity will show up here once they start rating, watching, or adding to watchlists."
                  : "Sign in to see what your friends are watching."}
              </div>
            )}
          </div>

          <div className="flex flex-col pt-8">
            <SectionHeader title="Trending Now" actionLabel="See All" onAction={seeAllTrending} />
            <div className="flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {trendingNow.isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="w-36 shrink-0">
                    <div className="aspect-[2/3] w-full animate-pulse rounded-[20px] bg-muted" />
                    <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                ))
              ) : (
                (trendingNow.data ?? []).map((item) => (
                  <div key={item.id} className="w-36 shrink-0">
                    <DiscoverPosterCard {...item} friendAvatarUrls={[]} friendExtraCount={0} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col pt-8">
            <SectionHeader title="Curated by Experts & Friends" />
            <div className="flex flex-col gap-3 px-4">
              {curatedLists.isLoading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-20 animate-pulse rounded-3xl bg-muted" />
                ))
              ) : curatedLists.data?.length ? (
                curatedLists.data.map((list) => (
                  <CuratedListCard
                    key={list.id}
                    id={list.id}
                    name={list.name}
                    description={list.description}
                    coverUrl={list.coverUrl}
                    ownerLabel={`by ${list.owner.displayName}`}
                    ownerAvatarUrl={list.owner.avatarUrl}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
                  Public lists will appear here once you or your friends publish them.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col pt-8">
            <SectionHeader title="Browse by Category" />
            <div className="grid grid-cols-3 gap-3 px-4">
              {discoverGenres.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    // Best-effort: take them into titles tab with genre filter stub.
                    // (Filters are applied server-side when query is present; we still store the genre id for future extension.)
                    setParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("tab", "titles");
                      next.set("genre", String(g.tmdbGenreId));
                      return next;
                    });
                  }}
                  className="flex h-20 items-center justify-center rounded-3xl border border-border bg-card/70 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-card"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          {/* Search results */}
          {activeChip === "people" ? (
            <SearchPeopleTab query={trimmedQuery} />
          ) : activeChip === "all" ? (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Titles</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChip("movies")}
                    className="h-8 rounded-full"
                  >
                    Movies
                  </Button>
                </div>
                {/* Lightweight list: reuse existing row renderer */}
                {titlesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(titlesQuery.data?.pages.flatMap((p) => p.results) ?? [])
                      .slice(0, 8)
                      .map((r) => (
                        <TitleSearchResultRow key={r.id} item={r} />
                      ))}
                    {(titlesQuery.data?.pages.flatMap((p) => p.results) ?? []).length > 8 ? (
                      <Button
                        variant="secondary"
                        className="w-full rounded-2xl"
                        onClick={() => setChip("movies")}
                      >
                        View more titles
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">People</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChip("people")}
                    className="h-8 rounded-full"
                  >
                    View all
                  </Button>
                </div>
                {peopleQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : peopleQuery.data?.length ? (
                  <div className="space-y-2">
                    {peopleQuery.data.slice(0, 6).map((p) => (
                      <PeoplePreviewRow key={p.id} person={p} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
                    No matching people.
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Titles view (movies/series)
            <SearchTitlesTab
              query={trimmedQuery}
              filters={filters}
              onResetFilters={() => {
                setParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("minYear");
                  next.delete("maxYear");
                  next.delete("lang");
                  next.set("type", "all");
                  return next;
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
