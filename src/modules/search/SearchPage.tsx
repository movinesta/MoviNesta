import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { TitleSearchFilters } from "./useSearchTitles";
import SearchTitlesTab from "./SearchTitlesTab";
import SearchPeopleTab from "./SearchPeopleTab";

type SearchTabKey = "titles" | "people";

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as SearchTabKey) ?? "titles";

  const [activeTab, setActiveTab] = useState<SearchTabKey>(initialTab);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [titleFilters, setTitleFilters] = useState<TitleSearchFilters>({
    type: "all",
    minYear: undefined,
    maxYear: undefined,
    originalLanguage: undefined,
  });

  const handleClearQuery = () => {
    setQuery("");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // In a later iteration, wire this up to real search requests.
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      {/* Intro copy */}
      <section className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-4 py-3 shadow-mn-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mn-text-muted">
              Search
            </p>
            <h1 className="mt-0.5 text-[15px] font-heading font-semibold text-mn-text-primary">
              Find the right movie – or the right people.
            </h1>
            <p className="mt-1 text-[11px] text-mn-text-secondary">
              Start typing a title, director, or a friend&apos;s name. Use tabs to
              switch between titles and people.
            </p>
          </div>

          <div className="hidden shrink-0 rounded-mn-pill border border-mn-border-subtle/70 bg-mn-bg/70 px-3 py-2 text-[11px] text-mn-text-secondary shadow-mn-soft sm:flex sm:flex-col sm:items-start">
            <p className="font-medium text-mn-text-primary">Pro tip</p>
            <p className="mt-0.5 text-[10px] text-mn-text-muted">
              Tap <span className="rounded border border-mn-border-subtle px-1">/</span> to
              jump to search from anywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Search bar + filters */}
      <section className="rounded-mn-card border border-mn-border-subtle bg-mn-bg-elevated/80 px-3 py-2 shadow-mn-soft">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
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
              if (activeTab !== "titles") return;
              setIsFiltersOpen((prev) => !prev);
            }}
            className={`inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2 text-[11px] font-medium shadow-mn-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-primary focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg ${
              activeTab === "titles"
                ? "border-mn-border-subtle bg-mn-bg text-mn-text-secondary hover:border-mn-primary/70 hover:text-mn-text-primary"
                : "border-mn-border-subtle/60 bg-mn-bg/70 text-mn-text-muted cursor-not-allowed"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Filters</span>
          </button>
        </form>
      </section>

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
            <SearchTitlesTab query={debouncedQuery} filters={titleFilters} />
          ) : (
            <SearchPeopleTab query={debouncedQuery} />
          )}
        </div>
      </section>
    </div>
  );
};

export default SearchPage;
