// src/modules/search/SearchPage.tsx
// Search page V2 (discover-first) based on Stitch mock.

import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MaterialIcon } from "@/components/ui/material-icon";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { useSearchPeople } from "./useSearchPeople";
import {
  useSearchTitles,
  type TitleSearchFilters,
  type TitleSearchResult,
} from "./useSearchTitles";
import SearchTitlesTab, { TitleSearchResultRow } from "./SearchTitlesTab";
import SearchPeopleTab from "./SearchPeopleTab";
import { PeopleResultRow, type PersonRowData } from "./PeopleResultRow";
import { sortTitles, type TitleSortKey } from "./titleSorting";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  type RecentSearchEntry,
} from "./recentSearches";
import {
  clampYear,
  parseTabFromParams,
  parseSortFromParams,
  parseTitleFiltersFromParams,
  type SearchTabKey,
} from "./searchState";

import FriendAvatarStack from "../swipe/FriendAvatarStack";
import { useAuth } from "../auth/AuthProvider";
import { useSuggestedPeople } from "../profile/useSuggestedPeople";
import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { isCatalogSyncResponse, type CatalogSyncResponse } from "@/lib/catalogSync";
import {
  useDiscoverGenres,
  useSearchCuratedLists,
  useSearchFriendsAreWatching,
  useSearchTrendingNow,
} from "./useSearchDiscover";

// Top chip bar (per product decision): All, Movies, Series, People.
type ChipKey = "all" | "movies" | "series" | "people";

type FriendProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const isUuid = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    value,
  );
};

const Chip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-muted/60 text-foreground hover:bg-muted"
    }`}
  >
    {label}
  </button>
);

const FilterPill: React.FC<{
  label: string;
  onClick?: () => void;
  onClear?: () => void;
}> = ({ label, onClick, onClear }) => (
  <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-card/80 pl-3 pr-1 py-1 text-xs font-semibold text-foreground shadow-sm">
    <button
      type="button"
      onClick={onClick}
      className="max-w-[220px] truncate text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      title={label}
    >
      {label}
    </button>
    {onClear ? (
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={`Clear ${label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    ) : null}
  </div>
);

const SectionHeader: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, actionLabel, onAction }) => (
  <div className="flex items-center justify-between gap-3 pb-[var(--section-gap)]">
    <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
      {title}
    </h2>
    {actionLabel && onAction ? (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center rounded-full border border-transparent px-3 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

const SectionContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="rounded-2xl border border-border/60 bg-card/40 card-pad shadow-sm">
    {children}
  </section>
);

const RatingPill: React.FC<{ label: string | null }> = ({ label }) => {
  if (!label) return null;
  return (
    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
      <MaterialIcon name="star" filled className="text-[14px] text-yellow-400" ariaLabel="Rating" />
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
  const friendProfiles: FriendProfileRow[] = (friendAvatarUrls ?? []).map((url, idx) => ({
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
    <Link
      to={`/title/${id}`}
      className="group flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div
        className="relative aspect-[2/3] w-full overflow-hidden rounded-[20px] bg-muted shadow-sm ring-1 ring-border/50 transition-transform duration-300 group-hover:scale-[1.02] group-hover:shadow-lg"
        style={
          imageUrl
            ? {
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
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
    className="flex items-center gap-3 rounded-3xl border border-border/70 bg-card/80 p-3 shadow-sm transition-all hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            <img
              src={ownerAvatarUrl}
              alt={ownerLabel}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-primary/20" />
          )}
        </div>
        <p className="truncate text-xs font-medium text-muted-foreground">{ownerLabel}</p>
      </div>
    </div>

    <MaterialIcon
      name="chevron_right"
      className="text-[22px] text-muted-foreground"
      ariaLabel="Open"
    />
  </Link>
);

function deriveChipFromTab(tab: SearchTabKey, filters: TitleSearchFilters): ChipKey {
  if (tab === "people") return "people";
  if (tab === "titles") {
    // Titles view is always either Movies or Series.
    if (filters.type === "series") return "series";
    return "movies";
  }
  return "all";
}

function chipToParams(chip: ChipKey): {
  tab: SearchTabKey;
  nextFilters?: Partial<TitleSearchFilters>;
} {
  if (chip === "people") return { tab: "people" };
  if (chip === "movies") return { tab: "titles", nextFilters: { type: "movie" } };
  if (chip === "series") return { tab: "titles", nextFilters: { type: "series" } };
  return { tab: "all" };
}

const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const suggestedPeople = useSuggestedPeople();
  const lastCommittedQueryRef = React.useRef<string>("");
  const commitRecentSearch = React.useCallback((raw: string) => {
    const term = raw.trim();
    if (term.length < 2) return;
    if (term === lastCommittedQueryRef.current) return;
    lastCommittedQueryRef.current = term;
    addRecentSearch(term);
  }, []);

  const [params, setParams] = useSearchParams();

  const queryFromUrl = (params.get("q") ?? "").toString();
  const [queryInput, setQueryInput] = React.useState<string>(queryFromUrl);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    setQueryInput(queryFromUrl);
  }, [queryFromUrl]);

  const debouncedQuery = useDebouncedValue(queryInput, 250);
  const trimmedQuery = debouncedQuery.trim();

  const tab = parseTabFromParams(params);
  const filters = parseTitleFiltersFromParams(params);
  const sortKey: TitleSortKey = parseSortFromParams(params, trimmedQuery);

  const hasSortOverride = Boolean(params.get("sort"));
  const sortLabel =
    sortKey === "relevance" ? "Relevance" : sortKey === "newest" ? "Newest" : "Rating";

  const [recentSearches, setRecentSearches] = React.useState<RecentSearchEntry[]>(() =>
    typeof window === "undefined" ? [] : getRecentSearches(),
  );
  const [syncingTitleId, setSyncingTitleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setRecentSearches(getRecentSearches());
    refresh();
    window.addEventListener("movinesta:recent-searches", refresh as any);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("movinesta:recent-searches", refresh as any);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const ensureCanonicalId = React.useCallback(async (item: TitleSearchResult) => {
    if (isUuid(item.id)) return item.id;
    if (!item.tmdbId) return null;
    const contentType = item.type === "series" ? "series" : "movie";

    try {
      const res = await callSupabaseFunction<CatalogSyncResponse>("catalog-sync", {
        tmdbId: item.tmdbId,
        contentType,
      });
      if (!isCatalogSyncResponse(res)) return null;
      return isUuid(res.media_item_id) ? res.media_item_id : null;
    } catch (err) {
      console.warn("[SearchPage] catalog-sync failed", err);
      return null;
    }
  }, []);

  const handleSelectTitle = React.useCallback(
    async (item: TitleSearchResult) => {
      if (syncingTitleId) return;
      setSyncingTitleId(item.id);
      try {
        const canonicalId = await ensureCanonicalId(item);
        if (!canonicalId) return;
        navigate(`/title/${canonicalId}`);
      } finally {
        setSyncingTitleId(null);
      }
    },
    [ensureCanonicalId, navigate, syncingTitleId],
  );
  // Extra title filters beyond the chip-selected type (Movies/Series).
  const hasExtraTitleFilters = Boolean(
    typeof filters.minYear === "number" ||
    typeof filters.maxYear === "number" ||
    Boolean(filters.originalLanguage) ||
    Boolean(filters.genreIds?.length),
  );

  const effectiveTab: SearchTabKey = tab;
  const activeChip = deriveChipFromTab(effectiveTab, filters);

  // Ensure the Titles view always has an explicit type (Movies/Series) so the chip bar stays consistent.
  React.useEffect(() => {
    if (effectiveTab !== "titles") return;
    if (filters.type === "movie" || filters.type === "series") return;

    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", "movie");
        return next;
      },
      { replace: true },
    );
  }, [effectiveTab, filters.type, setParams]);

  // Keep the URL in sync with the debounced query (replace history to avoid back button spam).
  React.useEffect(() => {
    if (debouncedQuery === queryFromUrl) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQuery.trim()) {
          next.set("q", debouncedQuery);
        } else {
          next.delete("q");
        }

        return next;
      },
      { replace: true },
    );
  }, [debouncedQuery, queryFromUrl, setParams]);

  const setChip = React.useCallback(
    (chip: ChipKey) => {
      const { tab: nextTab, nextFilters } = chipToParams(chip);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          // Preserve search string.
          next.set("tab", nextTab);

          if (nextTab === "people" || nextTab === "all") {
            next.delete("minYear");
            next.delete("maxYear");
            next.delete("lang");
            next.delete("genre");
            next.delete("genres");
            if (nextTab === "people") {
              // People view ignores title filters.
              next.delete("type");
              next.delete("sort");
            } else {
              // Combined "All" view should not be locked to movie/series.
              next.set("type", "all");
            }
          } else if (nextFilters?.type) {
            // Titles chip (Movies/Series): set the type explicitly.
            next.set("type", nextFilters.type);
          }

          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const setSort = React.useCallback(
    (nextSort: TitleSortKey) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("sort", nextSort);
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const clearQuery = React.useCallback(() => {
    setQueryInput("");
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const applyRecentSearch = React.useCallback(
    (term: string) => {
      const cleaned = term.trim();
      if (!cleaned) return;
      setQueryInput(cleaned);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("q", cleaned);
          // Default to combined view for recent searches.
          if (!next.get("tab")) {
            next.set("tab", "all");
          }
          return next;
        },
        { replace: false },
      );
    },
    [setParams],
  );

  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [draftMinYear, setDraftMinYear] = React.useState<string>(
    typeof filters.minYear === "number" ? String(filters.minYear) : "",
  );
  const [draftMaxYear, setDraftMaxYear] = React.useState<string>(
    typeof filters.maxYear === "number" ? String(filters.maxYear) : "",
  );
  const [draftLang, setDraftLang] = React.useState<string>(filters.originalLanguage ?? "");
  const [draftGenreIds, setDraftGenreIds] = React.useState<number[]>(filters.genreIds ?? []);

  // IMPORTANT: don't depend on the whole `filters` object here.
  // `parseTitleFiltersFromParams()` returns a new object each render, and if we set draft
  // state every render while the dialog is open, React will hit a maximum update depth loop.
  const genreSig = (filters.genreIds ?? []).join(",");
  React.useEffect(() => {
    if (!filtersOpen) return;
    setDraftMinYear(typeof filters.minYear === "number" ? String(filters.minYear) : "");
    setDraftMaxYear(typeof filters.maxYear === "number" ? String(filters.maxYear) : "");
    setDraftLang(filters.originalLanguage ?? "");
    setDraftGenreIds(filters.genreIds ?? []);
  }, [filtersOpen, filters.minYear, filters.maxYear, filters.originalLanguage, genreSig]);

  const applyFilters = React.useCallback(() => {
    const parseYear = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
    };

    let minYear = clampYear(parseYear(draftMinYear));
    let maxYear = clampYear(parseYear(draftMaxYear));
    if (minYear && maxYear && minYear > maxYear) {
      const swap = minYear;
      minYear = maxYear;
      maxYear = swap;
    }

    const language = draftLang.trim() ? draftLang.trim().toLowerCase() : undefined;
    const genreIds = (draftGenreIds ?? []).filter((id) => Number.isFinite(id) && id > 0);

    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        // Filters are title-only; switch the view to titles.
        next.set("tab", "titles");

        // Type is controlled by the top chips (Movies / Series). If missing, default to Movies.

        const existingType = next.get("type");

        if (existingType !== "movie" && existingType !== "series") {
          next.set("type", "movie");
        }
        if (typeof minYear === "number") next.set("minYear", String(minYear));
        else next.delete("minYear");

        if (typeof maxYear === "number") next.set("maxYear", String(maxYear));
        else next.delete("maxYear");

        if (language) next.set("lang", language);
        else next.delete("lang");

        next.delete("genre");
        next.delete("genres");
        if (genreIds.length) next.set("genres", genreIds.join(","));

        return next;
      },
      { replace: false },
    );
    setFiltersOpen(false);
  }, [draftGenreIds, draftLang, draftMaxYear, draftMinYear, setParams]);

  const resetFilters = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "titles");

        // Type is controlled by the top chips (Movies / Series). If missing, default to Movies.

        const existingType = next.get("type");

        if (existingType !== "movie" && existingType !== "series") {
          next.set("type", "movie");
        }
        next.delete("minYear");
        next.delete("maxYear");
        next.delete("lang");
        next.delete("genre");
        next.delete("genres");
        return next;
      },
      { replace: false },
    );
    setFiltersOpen(false);
  }, [setParams]);

  const clearTitleFiltersPreserveTab = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("minYear");
        next.delete("maxYear");
        next.delete("lang");
        next.delete("genre");
        next.delete("genres");
        return next;
      },
      { replace: false },
    );
  }, [setParams]);

  const clearSortOverride = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("sort");
        return next;
      },
      { replace: false },
    );
  }, [setParams]);

  const clearYearFilters = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("minYear");
        next.delete("maxYear");
        return next;
      },
      { replace: false },
    );
  }, [setParams]);

  const clearLanguageFilter = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("lang");
        return next;
      },
      { replace: false },
    );
  }, [setParams]);

  const clearGenreFilters = React.useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("genre");
        next.delete("genres");
        return next;
      },
      { replace: false },
    );
  }, [setParams]);

  const cycleSort = React.useCallback(() => {
    const order: TitleSortKey[] =
      trimmedQuery.length > 0 ? ["relevance", "newest", "rating"] : ["newest", "rating"];
    const idx = order.indexOf(sortKey);
    const next = idx >= 0 ? order[(idx + 1) % order.length] : order[0];
    setSort(next);
  }, [setSort, sortKey, trimmedQuery]);

  const openFilterSheet = React.useCallback(() => {
    if (effectiveTab === "people") return;

    // Filters are title-only. If the user is in the combined "All" view, jump them into Movies.
    if (effectiveTab === "all") {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "titles");
          return next;
        },
        { replace: false },
      );
    }

    setFiltersOpen(true);
  }, [effectiveTab, setParams]);

  // Global keyboard shortcuts:
  // - "/" focuses the search input (when not typing in another field)
  // - "Esc" closes filters (if open) otherwise clears the current query
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const isTextInput = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return Boolean((node as any).isContentEditable);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.key === "/" && !isTextInput(e.target)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape" && !isTextInput(e.target)) {
        if (filtersOpen) {
          e.preventDefault();
          setFiltersOpen(false);
          return;
        }
        // Clear the current query.
        e.preventDefault();
        clearQuery();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearQuery, filtersOpen]);

  const discoverGenres = useDiscoverGenres();

  const genreLabelById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const g of discoverGenres) {
      map.set(g.tmdbGenreId, g.label);
    }
    return map;
  }, [discoverGenres]);
  const trendingNow = useSearchTrendingNow(10);
  const friendsWatching = useSearchFriendsAreWatching(8);
  const curatedLists = useSearchCuratedLists(6);

  // Only fetch preview data here for the "All" tab.
  // The dedicated tabs (Titles/People) own their own fetching logic.
  const shouldSearchTitles = effectiveTab === "all";
  const shouldSearchPeople = effectiveTab === "all";

  const titlesQuery = useSearchTitles({
    query: shouldSearchTitles ? trimmedQuery : "",
    filters: shouldSearchTitles ? filters : undefined,
  });

  const peopleQuery = useSearchPeople(shouldSearchPeople ? trimmedQuery.replace(/^@+/, "") : "");

  const titlesPreviewItems = React.useMemo(() => {
    const pages = titlesQuery.data?.pages ?? [];
    const flattened = pages.flatMap((p) => p.results ?? []);
    if (!flattened.length) return [];
    // Sort within each loaded page for stability.
    const sorted = pages.flatMap((p) =>
      sortTitles({ items: p.results ?? [], query: trimmedQuery, sortKey }),
    );
    return sorted;
  }, [sortKey, titlesQuery.data, trimmedQuery]);

  // In the "All" tab, we only surface Movies + Series.
  const moviePreviewItems = React.useMemo(
    () => titlesPreviewItems.filter((t) => t.type === "movie"),
    [titlesPreviewItems],
  );

  const seriesPreviewItems = React.useMemo(
    () => titlesPreviewItems.filter((t) => t.type === "series"),
    [titlesPreviewItems],
  );

  const isDiscover = trimmedQuery.length === 0 && effectiveTab === "all";

  const seeAllTrending = React.useCallback(() => {
    // Best-effort: send them to swipe trending (already exists) if available.
    navigate("/swipe?mode=trending");
  }, [navigate]);

  const seeAllFriends = React.useCallback(() => {
    navigate("/activity");
  }, [navigate]);

  const yearPillLabel =
    typeof filters.minYear === "number" || typeof filters.maxYear === "number"
      ? `Year: ${
          typeof filters.minYear === "number" && typeof filters.maxYear === "number"
            ? `${filters.minYear}-${filters.maxYear}`
            : typeof filters.minYear === "number"
              ? `≥${filters.minYear}`
              : `≤${filters.maxYear}`
        }`
      : null;

  const langPillLabel = filters.originalLanguage
    ? `Lang: ${filters.originalLanguage.toUpperCase()}`
    : null;

  const genresPillLabel =
    (filters.genreIds?.length ?? 0) > 0
      ? (() => {
          const ids = filters.genreIds ?? [];
          const names = ids.map((id) => genreLabelById.get(id)).filter(Boolean) as string[];
          if (!names.length) return `Genres: ${ids.length}`;
          const first = names[0];
          const extra = names.length - 1;
          return extra > 0 ? `Genres: ${first} +${extra}` : `Genres: ${first}`;
        })()
      : null;

  const showQuickPills = effectiveTab === "titles" && (hasExtraTitleFilters || hasSortOverride);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background pb-2 text-foreground">
      {/* Top spacer (keeps content from hugging the very top under native safe areas) */}
      <div className="h-12 w-full" />

      {/* Title filters */}
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Year range</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={draftMinYear}
                  onChange={(e) =>
                    setDraftMinYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                  }
                  placeholder="From"
                  inputMode="numeric"
                />
                <Input
                  value={draftMaxYear}
                  onChange={(e) =>
                    setDraftMaxYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                  }
                  placeholder="To"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Language</p>
              <div className="flex flex-wrap items-center gap-2">
                {["en", "ar", "ja", "ko"].map((code) => {
                  const isActive = draftLang.toLowerCase() === code;
                  return (
                    <Button
                      key={code}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setDraftLang(code)}
                    >
                      {code.toUpperCase()}
                    </Button>
                  );
                })}
                <Input
                  value={draftLang}
                  onChange={(e) => setDraftLang(e.target.value.replace(/\s/g, "").slice(0, 8))}
                  placeholder="e.g. fr"
                  className="h-9 w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground">Use ISO-639-1 codes (en, ar...).</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Genres</p>
              <div className="flex flex-wrap gap-2">
                {discoverGenres.map((genre) => {
                  const isActive = draftGenreIds.includes(genre.tmdbGenreId);
                  return (
                    <Button
                      key={genre.tmdbGenreId}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() =>
                        setDraftGenreIds((prev) =>
                          prev.includes(genre.tmdbGenreId)
                            ? prev.filter((id) => id !== genre.tmdbGenreId)
                            : [...prev, genre.tmdbGenreId],
                        )
                      }
                    >
                      {genre.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button type="button" variant="outline" onClick={resetFilters} className="rounded-full">
              Reset
            </Button>
            <div className="flex w-full justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiltersOpen(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button type="button" onClick={applyFilters} className="rounded-full">
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky header */}
      <div className="sticky top-0 z-30 full-bleed border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--section-gap)] px-[var(--page-pad-x)] py-[var(--page-pad-y)] sm:px-[var(--page-pad-x)] sm:py-[var(--page-pad-y)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Discover
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Search
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Find movies, series, and people with tailored recommendations.
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              <span>Shortcut</span>
              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[11px] text-foreground">
                /
              </span>
              <span>to search</span>
            </div>
          </div>

          <label className="flex h-11 w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/30">
            <MaterialIcon
              name="search"
              className="text-[20px] text-muted-foreground"
              ariaLabel="Search"
            />
            <input
              ref={searchInputRef}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  clearQuery();
                  (e.currentTarget as HTMLInputElement).blur();
                  return;
                }
                if (e.key === "Enter") {
                  commitRecentSearch(queryInput);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              onBlur={() => commitRecentSearch(queryInput)}
              placeholder="Search movies, shows, people..."
              className="h-full flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />

            {queryInput ? (
              <button
                type="button"
                onClick={clearQuery}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={openFilterSheet}
              disabled={effectiveTab === "people"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40"
              aria-label="Filters"
            >
              <span className="relative inline-flex">
                <SlidersHorizontal className="h-4 w-4" />
                {hasExtraTitleFilters ? (
                  <span
                    className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
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

          {showQuickPills ? (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {hasSortOverride ? (
                <FilterPill
                  label={`Sort: ${sortLabel}`}
                  onClick={cycleSort}
                  onClear={clearSortOverride}
                />
              ) : null}

              {yearPillLabel ? (
                <FilterPill
                  label={yearPillLabel}
                  onClick={openFilterSheet}
                  onClear={clearYearFilters}
                />
              ) : null}

              {langPillLabel ? (
                <FilterPill
                  label={langPillLabel}
                  onClick={openFilterSheet}
                  onClear={clearLanguageFilter}
                />
              ) : null}

              {genresPillLabel ? (
                <FilterPill
                  label={genresPillLabel}
                  onClick={openFilterSheet}
                  onClear={clearGenreFilters}
                />
              ) : null}

              {hasExtraTitleFilters ? (
                <FilterPill label="Clear all" onClick={clearTitleFiltersPreserveTab} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      {isDiscover ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--section-gap)] px-[var(--page-pad-x)] pb-6 pt-[var(--page-pad-y)] sm:px-[var(--page-pad-x)]">
          {recentSearches.length ? (
            <SectionContainer>
              <SectionHeader
                title="Recent searches"
                actionLabel="Clear"
                onAction={clearRecentSearches}
              />
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((entry) => (
                  <div
                    key={entry.term}
                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 pl-3 pr-1 py-1 text-sm shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => applyRecentSearch(entry.term)}
                      className="max-w-[220px] truncate text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      title={entry.term}
                    >
                      {entry.term}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecentSearch(entry.term)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={`Remove ${entry.term}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </SectionContainer>
          ) : null}

          <SectionContainer>
            <SectionHeader
              title="Suggested People"
              actionLabel="See All"
              onAction={() => navigate("/suggested-people")}
            />
            {suggestedPeople.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : suggestedPeople.isError ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                Couldn&apos;t load suggestions right now.
              </div>
            ) : (suggestedPeople.data ?? []).length ? (
              <div className="space-y-3">
                {(suggestedPeople.data ?? []).slice(0, 5).map((p) => {
                  const row: PersonRowData = {
                    id: p.id,
                    username: p.username,
                    displayName: p.displayName,
                    avatarUrl: p.avatarUrl,
                    bio: p.bio,
                    followersCount: p.followersCount,
                    followingCount: p.followingCount,
                    isFollowing: p.isFollowing,
                    matchPercent: p.matchPercent ?? null,
                  };

                  return (
                    <PeopleResultRow
                      key={p.id}
                      person={row}
                      variant="compact"
                      showMessage={false}
                      showDismiss
                      onDismiss={() => suggestedPeople.dismissPerson(p.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                {user?.id
                  ? "No suggestions right now."
                  : "Sign in to get personalized people suggestions."}
              </div>
            )}
          </SectionContainer>

          <SectionContainer>
            <SectionHeader
              title="Friends Are Watching"
              actionLabel="See All"
              onAction={seeAllFriends}
            />
            <div className="grid grid-cols-2 gap-3">
            {friendsWatching.isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="aspect-[2/3] w-full animate-pulse rounded-[20px] bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))
            ) : friendsWatching.data?.length ? (
              friendsWatching.data.map((item) => <DiscoverPosterCard key={item.id} {...item} />)
            ) : (
              <div className="col-span-2 rounded-3xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                {user?.id
                  ? "Your friends’ activity will show up here once they start rating, watching, or adding to watchlists."
                  : "Sign in to see what your friends are watching."}
              </div>
            )}
            </div>
          </SectionContainer>

          <SectionContainer>
            <SectionHeader title="Trending Now" actionLabel="See All" onAction={seeAllTrending} />
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {trendingNow.isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="w-36 shrink-0">
                    <div className="aspect-[2/3] w-full animate-pulse rounded-[20px] bg-muted" />
                    <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
                  </div>
                ))
              ) : trendingNow.isError ? (
                <div className="w-full shrink-0 rounded-3xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        Trending is temporarily unavailable.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(trendingNow.error as any)?.message ?? "Please try again."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => trendingNow.refetch()}
                      disabled={trendingNow.isFetching}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : trendingNow.data?.length ? (
                trendingNow.data.map((item) => (
                  <div key={item.id} className="w-36 shrink-0">
                    <DiscoverPosterCard {...item} friendAvatarUrls={[]} friendExtraCount={0} />
                  </div>
                ))
              ) : (
                <div className="w-full shrink-0 rounded-3xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {user?.id
                        ? "No trending titles right now."
                        : "No trending titles right now. (Sign in to personalize your feed.)"}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => trendingNow.refetch()}
                      disabled={trendingNow.isFetching}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SectionContainer>

          <SectionContainer>
            <SectionHeader title="Curated by Experts & Friends" />
            <div className="flex flex-col gap-3">
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
                <div className="rounded-3xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                  Public lists will appear here once you or your friends publish them.
                </div>
              )}
            </div>
          </SectionContainer>

          <SectionContainer>
            <SectionHeader title="Browse by Category" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {discoverGenres.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    setParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("tab", "titles");
                        next.delete("genre");
                        next.delete("genres");
                        next.set("genres", String(g.tmdbGenreId));
                        return next;
                      },
                      { replace: false },
                    );
                  }}
                  className="flex h-20 items-center justify-center rounded-3xl border border-border/70 bg-card/80 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {g.label}
                </button>
              ))}
            </div>
          </SectionContainer>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl px-[var(--page-pad-x)] pb-6 pt-[var(--page-pad-y)] sm:px-[var(--page-pad-x)]">
          {/* Search results */}
          {effectiveTab === "people" ? (
            trimmedQuery.length === 0 ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                  Type a name or @username to search, or browse suggested people below.
                </div>

                <div>
                  <SectionHeader
                    title="Suggested People"
                    actionLabel="See All"
                    onAction={() => navigate("/suggested-people")}
                  />
                  {suggestedPeople.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-16 animate-pulse rounded-2xl bg-muted" />
                      ))}
                    </div>
                  ) : suggestedPeople.isError ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      Couldn&apos;t load suggestions right now.
                    </div>
                  ) : (suggestedPeople.data ?? []).length ? (
                    <div className="space-y-3">
                      {(suggestedPeople.data ?? []).slice(0, 8).map((p) => {
                        const row: PersonRowData = {
                          id: p.id,
                          username: p.username,
                          displayName: p.displayName,
                          avatarUrl: p.avatarUrl,
                          bio: p.bio,
                          followersCount: p.followersCount,
                          followingCount: p.followingCount,
                          isFollowing: p.isFollowing,
                          matchPercent: p.matchPercent ?? null,
                        };

                        return (
                          <PeopleResultRow
                            key={p.id}
                            person={row}
                            variant="compact"
                            showMessage={false}
                            showDismiss
                            onDismiss={() => suggestedPeople.dismissPerson(p.id)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      {user?.id
                        ? "No suggestions right now."
                        : "Sign in to get personalized people suggestions."}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <SearchPeopleTab query={trimmedQuery} />
            )
          ) : effectiveTab === "all" ? (
            trimmedQuery.length > 0 && trimmedQuery.length < 2 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                  Keep typing to search — enter at least{" "}
                  <span className="font-semibold text-foreground">2 characters</span>.
                </div>
                <div className="rounded-2xl border border-border bg-background/60 card-pad text-xs text-muted-foreground">
                  Tip: Use the filters button to browse without typing (genres, year, language).
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Movies */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        Movies{moviePreviewItems.length ? ` (${moviePreviewItems.length})` : ""}
                      </p>
                      {titlesQuery.isFetching && !titlesQuery.isLoading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChip("movies")}
                      className="h-8 rounded-full"
                    >
                      See all
                    </Button>
                  </div>
                  {titlesQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                      ))}
                    </div>
                  ) : titlesQuery.isError ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">Couldn&#39;t load movies</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(titlesQuery.error as any)?.message ?? "Please try again."}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => titlesQuery.refetch()}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : moviePreviewItems.length ? (
                    <div className="space-y-2">
                      {moviePreviewItems.slice(0, 6).map((r) => (
                        <TitleSearchResultRow
                          key={r.id}
                          item={r}
                          query={trimmedQuery}
                          onSelect={handleSelectTitle}
                          disabled={Boolean(syncingTitleId)}
                          loading={syncingTitleId === r.id}
                        />
                      ))}
                      {moviePreviewItems.length > 6 ? (
                        <Button
                          variant="secondary"
                          className="w-full rounded-2xl"
                          onClick={() => setChip("movies")}
                        >
                          View more movies
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">No matching movies.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try a different spelling, or use filters to browse by genre, year, or
                        language.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={openFilterSheet}
                        >
                          Open filters
                        </Button>
                        {trimmedQuery.startsWith("@") ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full"
                            onClick={() => setChip("people")}
                          >
                            Search people
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Series */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        Series{seriesPreviewItems.length ? ` (${seriesPreviewItems.length})` : ""}
                      </p>
                      {titlesQuery.isFetching && !titlesQuery.isLoading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChip("series")}
                      className="h-8 rounded-full"
                    >
                      See all
                    </Button>
                  </div>
                  {titlesQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
                      ))}
                    </div>
                  ) : titlesQuery.isError ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">Couldn&#39;t load series</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(titlesQuery.error as any)?.message ?? "Please try again."}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => titlesQuery.refetch()}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : seriesPreviewItems.length ? (
                    <div className="space-y-2">
                      {seriesPreviewItems.slice(0, 6).map((r) => (
                        <TitleSearchResultRow
                          key={r.id}
                          item={r}
                          query={trimmedQuery}
                          onSelect={handleSelectTitle}
                          disabled={Boolean(syncingTitleId)}
                          loading={syncingTitleId === r.id}
                        />
                      ))}
                      {seriesPreviewItems.length > 6 ? (
                        <Button
                          variant="secondary"
                          className="w-full rounded-2xl"
                          onClick={() => setChip("series")}
                        >
                          View more series
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      <p className="font-semibold text-foreground">No matching series.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try a different spelling, or use filters to browse by genre, year, or
                        language.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={openFilterSheet}
                        >
                          Open filters
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* People */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        People{peopleQuery.data?.length ? ` (${peopleQuery.data.length})` : ""}
                      </p>
                      {peopleQuery.isFetching && !peopleQuery.isLoading ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChip("people")}
                      className="h-8 rounded-full"
                    >
                      See all
                    </Button>
                  </div>
                  {peopleQuery.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                      ))}
                    </div>
                  ) : peopleQuery.isError ? (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">Couldn&#39;t load people</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(peopleQuery.error as any)?.message ?? "Please try again."}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => peopleQuery.refetch()}
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  ) : peopleQuery.data?.length ? (
                    <div className="space-y-2">
                      {peopleQuery.data.slice(0, 6).map((p) => {
                        const row: PersonRowData = {
                          id: p.id,
                          username: p.username,
                          displayName: p.displayName,
                          avatarUrl: p.avatarUrl,
                          bio: p.bio,
                          followersCount: p.followersCount ?? null,
                          followingCount: p.followingCount ?? null,
                          isFollowing: p.isFollowing,
                          matchPercent: p.matchPercent ?? null,
                        };
                        return (
                          <PeopleResultRow
                            key={p.id}
                            person={row}
                            variant="compact"
                            showFollow
                            showMessage
                            highlightQuery={trimmedQuery.replace(/^@+/, "")}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/50 card-pad text-sm text-muted-foreground">
                      No matching people.
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <SearchTitlesTab
              query={trimmedQuery}
              filters={filters}
              sortKey={sortKey}
              onChangeSort={setSort}
              onResetFilters={resetFilters}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
