import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Languages, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { TitleSearchFilters } from "./useSearchTitles";
import SearchTitlesTab from "./SearchTitlesTab";
import SearchPeopleTab from "./SearchPeopleTab";

type SearchTabKey = "titles" | "people";

const validTypes: TitleSearchFilters["type"][] = ["all", "movie", "series", "anime"];

const parseTabFromParams = (params: URLSearchParams): SearchTabKey => {
  const tabParam = params.get("tab");
  return tabParam === "people" ? "people" : "titles";
};

const clampYear = (value: number | undefined) => {
  if (typeof value !== "number") return undefined;
  const currentYear = new Date().getFullYear();
  const lowerBound = 1900;
  return Math.min(Math.max(value, lowerBound), currentYear);
};

const parseTitleFiltersFromParams = (params: URLSearchParams): TitleSearchFilters => {
  const typeParam = params.get("type");
  const type = validTypes.includes(typeParam as TitleSearchFilters["type"])
    ? (typeParam as TitleSearchFilters["type"])
    : "all";

  const parseYear = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const minYear = clampYear(parseYear(params.get("minYear")));
  const maxYear = clampYear(parseYear(params.get("maxYear")));
  const originalLanguage = params.get("lang") || undefined;

  if (minYear && maxYear && minYear > maxYear) {
    return { type, minYear: maxYear, maxYear: minYear, originalLanguage };
  }

  return { type, minYear, maxYear, originalLanguage };
};

const areFiltersEqual = (a: TitleSearchFilters, b: TitleSearchFilters) =>
  a.type === b.type &&
  a.minYear === b.minYear &&
  a.maxYear === b.maxYear &&
  a.originalLanguage === b.originalLanguage;

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = parseTabFromParams(searchParams);
  const initialQuery = searchParams.get("q") ?? "";
  const initialFilters = useMemo(() => parseTitleFiltersFromParams(searchParams), [searchParams]);

  const [activeTab, setActiveTab] = useState<SearchTabKey>(initialTab);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 300);
  const [titleFilters, setTitleFilters] = useState<TitleSearchFilters>(initialFilters);

  // Hide filters when switching away from the titles tab
  useEffect(() => {
    if (activeTab !== "titles") {
      setIsFiltersOpen(false);
    }
  }, [activeTab]);

  // If the query has been cleared, hide the filters sheet to keep the UI tidy.
  useEffect(() => {
    if (!debouncedQuery.trim() && isFiltersOpen) {
      setIsFiltersOpen(false);
    }
  }, [debouncedQuery, isFiltersOpen]);

  // Keep tab and query in sync with the URL so back/forward navigation keeps state.
  const nextSearchParams = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", activeTab);
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }

    if (activeTab === "titles" && query.trim()) {
      params.set("type", titleFilters.type);
      if (titleFilters.minYear) {
        params.set("minYear", String(titleFilters.minYear));
      } else {
        params.delete("minYear");
      }

      if (titleFilters.maxYear) {
        params.set("maxYear", String(titleFilters.maxYear));
      } else {
        params.delete("maxYear");
      }

      if (titleFilters.originalLanguage) {
        params.set("lang", titleFilters.originalLanguage);
      } else {
        params.delete("lang");
      }
    } else {
      params.delete("type");
      params.delete("minYear");
      params.delete("maxYear");
      params.delete("lang");
    }
    return params;
  }, [activeTab, query, searchParams, titleFilters]);

  useEffect(() => {
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [nextSearchParams, searchParams, setSearchParams]);

  // Respond to external URL changes (e.g., back/forward) by syncing local state.
  useEffect(() => {
    const tabFromParams = parseTabFromParams(searchParams);
    const queryFromParams = searchParams.get("q") ?? "";
    const filtersFromParams = parseTitleFiltersFromParams(searchParams);

    setActiveTab(tabFromParams);
    setQuery(queryFromParams);
    setTitleFilters((prev) =>
      areFiltersEqual(prev, filtersFromParams) ? prev : filtersFromParams,
    );
  }, [searchParams]);

  useEffect(() => {
    const normalizedMin = clampYear(titleFilters.minYear);
    const normalizedMax = clampYear(titleFilters.maxYear);

    if (normalizedMin && normalizedMax && normalizedMin > normalizedMax) {
      setTitleFilters((prev) => ({ ...prev, minYear: normalizedMax, maxYear: normalizedMin }));
      return;
    }

    if (normalizedMin !== titleFilters.minYear || normalizedMax !== titleFilters.maxYear) {
      setTitleFilters((prev) => ({ ...prev, minYear: normalizedMin, maxYear: normalizedMax }));
    }
  }, [titleFilters.maxYear, titleFilters.minYear]);

  const handleClearQuery = () => {
    setQuery("");
    setIsFiltersOpen(false);
  };

  const updateFilters = useCallback((updates: Partial<TitleSearchFilters>) => {
    setTitleFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleResetFilters = () => {
    setTitleFilters({
      type: "all",
      minYear: undefined,
      maxYear: undefined,
      originalLanguage: undefined,
    });
    setIsFiltersOpen(false);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];

    if (titleFilters.type !== "all") {
      chips.push({
        label: `Type: ${titleFilters.type.charAt(0).toUpperCase()}${titleFilters.type.slice(1)}`,
        onRemove: () => updateFilters({ type: "all" }),
      });
    }

    if (titleFilters.minYear || titleFilters.maxYear) {
      const min = titleFilters.minYear ?? "Any";
      const max = titleFilters.maxYear ?? "Now";
      chips.push({
        label: `Year: ${min} – ${max}`,
        onRemove: () => updateFilters({ minYear: undefined, maxYear: undefined }),
      });
    }

    if (titleFilters.originalLanguage) {
      chips.push({
        label: `Language: ${titleFilters.originalLanguage.toUpperCase()}`,
        onRemove: () => updateFilters({ originalLanguage: undefined }),
      });
    }

    return chips;
  }, [titleFilters, updateFilters]);

  const activeFilterCount = activeFilterChips.length;
  const filtersButtonLabel =
    activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : "Filters (none applied)";
  const canOpenFilters = activeTab === "titles" && (Boolean(query.trim()) || activeFilterCount > 0);
  const filterAvailabilityLabel = canOpenFilters
    ? filtersButtonLabel
    : "Filters are locked until you start typing a title";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // In a later iteration, wire this up to real search requests.
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar
        title="Search without the clutter"
        subtitle="Find titles, filmmakers, or friends instantly. Switch tabs to move between movies and people."
      />

      {/* Search bar + filters */}
      <PageSection tone="default" padded>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-mn-border-subtle bg-mn-bg px-3 py-2 text-[13px] shadow-mn-soft focus-within:border-mn-primary/70">
            <SearchIcon className="h-3.5 w-3.5 text-mn-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for movies, shows, or people..."
              className="flex-1 bg-transparent text-[13px] text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none"
              autoCorrect="off"
              autoCapitalize="none"
            />
            {query ? (
              <button
                type="button"
                onClick={handleClearQuery}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] text-mn-text-muted hover:bg-mn-border-subtle/60 hover:text-mn-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!canOpenFilters) return;
              setIsFiltersOpen((prev) => !prev);
            }}
            className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2 text-[11px] font-medium shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg ${
              canOpenFilters
                ? "border-mn-border-subtle bg-mn-bg text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-text-primary"
                : "cursor-not-allowed border-mn-border-subtle/60 bg-mn-bg/70 text-mn-text-muted"
            } ${isFiltersOpen ? "border-mn-primary/70 text-mn-text-primary" : ""}`}
            disabled={!canOpenFilters}
            aria-pressed={canOpenFilters && isFiltersOpen}
            aria-expanded={canOpenFilters && isFiltersOpen}
            aria-controls="search-title-filters"
            aria-label={filterAvailabilityLabel}
            title={filterAvailabilityLabel}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isFiltersOpen ? "Hide filters" : "Filters"}</span>
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-mn-primary/15 px-1 text-[10px] font-semibold text-mn-primary">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          {!canOpenFilters ? (
            <span className="text-[10px] text-mn-text-muted sm:ml-1 sm:inline" aria-live="polite">
              Start typing to enable title filters.
            </span>
          ) : (
            <span className="sr-only" aria-live="polite">
              Filters are available. {filtersButtonLabel}
            </span>
          )}
        </form>

        {activeTab === "titles" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mn-text-secondary">
            {activeFilterChips.length ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-mn-text-muted">
                  Active filters
                </span>
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle bg-mn-bg px-2 py-1 text-[11px] text-mn-text-primary shadow-sm transition hover:border-mn-primary/70 hover:text-mn-text-primary"
                  >
                    <span>{chip.label}</span>
                    <X className="h-3 w-3 text-mn-text-muted" aria-hidden />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 rounded-full bg-mn-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-mn-primary transition hover:bg-mn-primary/15"
                >
                  Reset all
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-mn-bg-elevated/50 px-2.5 py-1 text-[10px] font-medium text-mn-text-muted">
                <Filter className="h-3 w-3" aria-hidden />
                No filters applied
              </span>
            )}
          </div>
        )}

        {activeTab === "titles" && isFiltersOpen && (
          <div
            id="search-title-filters"
            className="mt-3 space-y-3 rounded-xl border border-dashed border-mn-border-subtle/80 bg-mn-bg/70 p-3 text-[11px] text-mn-text-secondary"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium text-mn-text-primary">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter titles</span>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
                  Type
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "movie", label: "Movies" },
                      { key: "series", label: "Series" },
                      { key: "anime", label: "Anime" },
                    ] as const
                  ).map((option) => {
                    const isActive = titleFilters.type === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                          isActive
                            ? "bg-mn-primary text-mn-bg shadow-mn-soft"
                            : "border border-mn-border-subtle bg-mn-bg/80 text-mn-text-secondary hover:border-mn-primary/60 hover:text-mn-text-primary"
                        }`}
                        onClick={() => updateFilters({ type: option.key })}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
                  Years
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear()}
                    value={titleFilters.minYear ?? ""}
                    onChange={(event) =>
                      updateFilters({
                        minYear: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                    placeholder="Min"
                    className="w-full rounded-md border border-mn-border-subtle bg-mn-bg px-2 py-1.5 text-[11px] text-mn-text-primary shadow-sm outline-none focus:border-mn-border-strong focus:ring-2 focus:ring-mn-border-strong/30"
                    aria-label="Minimum year"
                  />
                  <input
                    type="number"
                    min={1900}
                    max={new Date().getFullYear()}
                    value={titleFilters.maxYear ?? ""}
                    onChange={(event) =>
                      updateFilters({
                        maxYear: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                    placeholder="Max"
                    className="w-full rounded-md border border-mn-border-subtle bg-mn-bg px-2 py-1.5 text-[11px] text-mn-text-primary shadow-sm outline-none focus:border-mn-border-strong focus:ring-2 focus:ring-mn-border-strong/30"
                    aria-label="Maximum year"
                  />
                </div>
                <p className="text-[10px] text-mn-text-muted">Use a minimum, maximum, or both.</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mn-text-muted">
                  Original language
                </p>
                <div className="flex items-center gap-1.5 rounded-md border border-mn-border-subtle bg-mn-bg px-2 py-1.5 shadow-sm">
                  <Languages className="h-3.5 w-3.5 text-mn-text-muted" aria-hidden="true" />
                  <input
                    type="text"
                    value={titleFilters.originalLanguage ?? ""}
                    onChange={(event) =>
                      updateFilters({
                        originalLanguage: event.target.value || undefined,
                      })
                    }
                    placeholder="e.g. en, ja"
                    className="w-full bg-transparent text-[11px] text-mn-text-primary placeholder:text-mn-text-muted focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-mn-text-muted">
                  Two-letter codes keep things simple.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-[10px] text-mn-text-muted">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-mn-primary/80" />
                Filters shape the recommendations shown below.
              </p>
              <button
                type="button"
                className="text-[10px] font-semibold text-mn-text-primary hover:text-mn-primary"
                onClick={handleResetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </PageSection>

      {/* Tabs + results */}
      <section className="flex flex-1 flex-col gap-3">
        {/* Tabs */}
        <div className="inline-flex items-center gap-1 rounded-full border border-mn-border-subtle bg-mn-bg-elevated/80 p-1 text-[11px] shadow-mn-soft">
          {(
            [
              { key: "titles" as const, label: "Titles" },
              { key: "people" as const, label: "People" },
            ] satisfies { key: SearchTabKey; label: string }[]
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "inline-flex min-w-[70px] items-center justify-center rounded-full px-3 py-1.5 transition",
                  isActive
                    ? "bg-mn-primary text-mn-bg text-[11px] font-semibold"
                    : "text-[11px] font-medium text-mn-text-secondary hover:bg-mn-border-subtle/40 hover:text-mn-text-primary",
                ].join(" ")}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Results placeholder – wired to existing tab components for now */}
        <div
          aria-live="polite"
          className="flex-1 rounded-mn-card border border-dashed border-mn-border-subtle/80 bg-mn-bg-elevated/60 px-3 py-3 text-[12px] text-mn-text-secondary"
        >
          {activeTab === "titles" ? (
            <SearchTitlesTab
              query={debouncedQuery}
              filters={titleFilters}
              onResetFilters={handleResetFilters}
            />
          ) : (
            <SearchPeopleTab query={debouncedQuery} />
          )}
        </div>
      </section>
    </div>
  );
};

export default SearchPage;
