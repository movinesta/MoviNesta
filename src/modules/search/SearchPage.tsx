import React, { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Filter, Languages, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import SearchField from "../../components/shared/SearchField";
import { PageSection } from "../../components/PageChrome";
import TopBar from "../../components/shared/TopBar";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { TitleSearchFilters } from "./useSearchTitles";
import {
  parseTabFromParams,
  parseTitleFiltersFromParams,
  clampYear,
  type SearchTabKey,
} from "./searchState";
import SearchTitlesTab from "./SearchTitlesTab";
import SearchPeopleTab from "./SearchPeopleTab";

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(() => parseTabFromParams(searchParams), [searchParams]);
  const queryFromParams = searchParams.get("q") ?? "";
  const debouncedQuery = useDebouncedValue(queryFromParams, 300);
  const titleFilters = useMemo(() => parseTitleFiltersFromParams(searchParams), [searchParams]);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const updateSearchParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      updater(params);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearFilterParams = useCallback((params: URLSearchParams) => {
    params.delete("type");
    params.delete("minYear");
    params.delete("maxYear");
    params.delete("lang");
  }, []);

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab = value as SearchTabKey;
      updateSearchParams((params) => {
        params.set("tab", nextTab);
        if (!params.get("q")) {
          clearFilterParams(params);
        }
      });

      if (nextTab !== "titles") {
        setIsFiltersOpen(false);
      }
    },
    [clearFilterParams, updateSearchParams],
  );

  const handleClearQuery = () => {
    updateSearchParams((params) => {
      params.delete("q");
      clearFilterParams(params);
    });
    setIsFiltersOpen(false);
  };

  const handleQueryChange = (value: string) => {
    const trimmed = value.trim();
    updateSearchParams((params) => {
      if (trimmed) {
        params.set("q", trimmed);
        params.set("tab", "titles");
      } else {
        params.delete("q");
        clearFilterParams(params);
      }
    });

    if (!trimmed) {
      setIsFiltersOpen(false);
    }
  };

  const updateFilters = useCallback(
    (updates: Partial<TitleSearchFilters>) => {
      updateSearchParams((params) => {
        const merged = { ...titleFilters, ...updates };
        const normalizedMin = clampYear(merged.minYear);
        const normalizedMax = clampYear(merged.maxYear);

        const next: TitleSearchFilters = {
          ...merged,
          minYear: normalizedMin ?? undefined,
          maxYear: normalizedMax ?? undefined,
        };

        if (next.minYear && next.maxYear && next.minYear > next.maxYear) {
          [next.minYear, next.maxYear] = [next.maxYear, next.minYear];
        }

        params.set("tab", "titles");
        params.set("type", next.type ?? "all");

        if (next.minYear) {
          params.set("minYear", String(next.minYear));
        } else {
          params.delete("minYear");
        }

        if (next.maxYear) {
          params.set("maxYear", String(next.maxYear));
        } else {
          params.delete("maxYear");
        }

        if (next.originalLanguage) {
          params.set("lang", next.originalLanguage);
        } else {
          params.delete("lang");
        }
      });
    },
    [titleFilters, updateSearchParams],
  );

  const handleResetFilters = () => {
    updateSearchParams((params) => {
      params.set("tab", "titles");
      params.set("type", "all");
      params.delete("minYear");
      params.delete("maxYear");
      params.delete("lang");
    });
    setIsFiltersOpen(false);
  };

  const activeFilterChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];

    if (titleFilters.type && titleFilters.type !== "all") {
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
  const canOpenFilters =
    activeTab === "titles" && (Boolean(queryFromParams.trim()) || activeFilterCount > 0);
  const filterAvailabilityLabel = canOpenFilters
    ? filtersButtonLabel
    : "Filters are locked until you start typing a title";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // In a later iteration, wire this up to real search requests.
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-4">
      <TopBar
        title="Search without the clutter"
        subtitle="Find titles, filmmakers, or friends instantly. Switch tabs to move between movies and people."
      />

      {/* Search bar + filters */}
      <PageSection tone="default" padded>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <SearchField
              placeholder="Search for movies, shows, or people..."
              value={queryFromParams}
              onChange={(event) => handleQueryChange(event.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              className="flex-1"
            />
            {queryFromParams ? (
              <Button
                type="button"
                onClick={handleClearQuery}
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-xs text-muted-foreground hover:bg-border/60 hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={() => {
              if (!canOpenFilters) return;
              setIsFiltersOpen((prev) => !prev);
            }}
            variant="outline"
            size="sm"
            className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-medium shadow-md ${
              canOpenFilters
                ? "border-border bg-background text-muted-foreground hover:border-primary/70 hover:text-foreground"
                : "cursor-not-allowed border-border bg-background/70 text-muted-foreground"
            } ${isFiltersOpen ? "border-primary/70 text-foreground" : ""}`}
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
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1 text-xs font-semibold text-primary">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </form>

        {activeTab === "titles" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {activeFilterChips.length ? (
              <>
                <Chip className="gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Active filters
                </Chip>
                {activeFilterChips.map((chip) => (
                  <Button
                    key={chip.label}
                    type="button"
                    onClick={chip.onRemove}
                    variant="outline"
                    size="sm"
                    className="h-auto rounded-full border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm hover:border-primary/70 hover:text-foreground"
                  >
                    <span>{chip.label}</span>
                    <X className="h-3 w-3 text-muted-foreground" aria-hidden />
                  </Button>
                ))}
                <Button
                  type="button"
                  onClick={handleResetFilters}
                  variant="ghost"
                  size="sm"
                  className="h-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/15"
                >
                  Reset all
                </Button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-card/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" aria-hidden />
                No filters applied
              </span>
            )}
          </div>
        )}

        {activeTab === "titles" && isFiltersOpen && (
          <div
            id="search-title-filters"
            className="mt-3 space-y-3 rounded-xl border border-dashed border-border bg-background/70 p-3 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Filter titles</span>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
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
                      <Button
                        key={option.key}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        className={`h-auto rounded-full px-2.5 py-1 text-xs font-medium ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "border-border bg-background/80 text-muted-foreground hover:border-primary/60 hover:text-foreground"
                        }`}
                        onClick={() => updateFilters({ type: option.key })}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Years
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input
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
                    className="h-9 w-full border-border bg-background px-2 py-1.5 text-xs text-foreground shadow-sm"
                    aria-label="Minimum year"
                  />
                  <Input
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
                    className="h-9 w-full border-border bg-background px-2 py-1.5 text-xs text-foreground shadow-sm"
                    aria-label="Maximum year"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use a minimum, maximum, or both.</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Original language
                </p>
                <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 shadow-sm">
                  <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="text"
                    value={titleFilters.originalLanguage ?? ""}
                    onChange={(event) =>
                      updateFilters({
                        originalLanguage: event.target.value || undefined,
                      })
                    }
                    placeholder="e.g. en, ja"
                    className="h-8 w-full border-none bg-transparent p-0 text-xs text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Two-letter codes keep things simple.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary/80" />
                Filters shape the recommendations shown below.
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs font-semibold text-foreground hover:text-primary"
                onClick={handleResetFilters}
              >
                Reset filters
              </Button>
            </div>
          </div>
        )}
      </PageSection>

      {/* Tabs + results */}
      <section className="flex flex-1 flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-lg">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="w-full">
                <TabsTrigger value="titles">Titles</TabsTrigger>
                <TabsTrigger value="people">People</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div
          aria-live="polite"
          className="flex-1 rounded-2xl border border-dashed border-border bg-card/60 px-3 py-3 text-[12px] text-muted-foreground"
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
