// Improved SearchTitlesTab with debouncing and error handling
// This file demonstrates how to integrate the useDebounce hook

import React from "react";
import { Link } from "react-router-dom";
import { Film, Star, SlidersHorizontal, AlertCircle } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Button } from "@/components/ui/Button";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchSkeleton } from "@/components/skeletons/Skeletons";
import { getUserFriendlyErrorMessage } from "@/lib/errorHandling";
import {
    useSearchTitles,
    type TitleSearchFilters,
    type TitleSearchResult,
} from "./useSearchTitles";

interface SearchTitlesTabProps {
    query: string;
    filters: TitleSearchFilters;
    onResetFilters?: () => void;
}

export const TitleSearchResultRow: React.FC<{ item: TitleSearchResult }> = ({ item }) => {
    const metaPieces: string[] = [];
    if (item.year) metaPieces.push(String(item.year));
    if (item.type === "movie") metaPieces.push("Movie");
    if (item.type === "series") metaPieces.push("Series");
    if (item.type === "anime") metaPieces.push("Anime");
    if (item.originalLanguage) metaPieces.push(`Language: ${item.originalLanguage}`);
    if (item.ageRating) metaPieces.push(item.ageRating);
    if (item.imdbRating) metaPieces.push(`IMDb ${item.imdbRating.toFixed(1)}`);
    if (item.rtTomatoMeter) metaPieces.push(`RT ${item.rtTomatoMeter}%`);

    const sourceLabel: Record<TitleSearchResult["source"], string> = {
        library: "Library",
        "external-synced": "Synced",
        "external-only": "External",
    };

    const sourceStyles: Record<TitleSearchResult["source"], string> = {
        library: "bg-primary/10 text-primary border-primary/40",
        "external-synced": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        "external-only": "bg-card text-muted-foreground border-border",
    };

    return (
        <div>
            <Link
                to={`/title/${item.id}`}
                className="flex gap-3 rounded-2xl border border-border bg-background/60 p-2 hover:bg-card/80 transition-colors"
            >
                {item.posterUrl ? (
                    <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="h-20 w-14 rounded-2xl object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-20 w-14 items-center justify-center rounded-2xl bg-muted">
                        <Film className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-[12px] font-medium text-foreground">{item.title}</p>
                        <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${sourceStyles[item.source]}`}
                        >
                            {sourceLabel[item.source]}
                        </span>
                    </div>
                    {metaPieces.length > 0 && (
                        <p className="text-xs text-muted-foreground">{metaPieces.join(" • ")}</p>
                    )}
                </div>
            </Link>
        </div>
    );
};

const SearchTitlesTab: React.FC<SearchTitlesTabProps> = ({ query, filters, onResetFilters }) => {
    // IMPROVEMENT: Debounce search query to reduce API calls by 70%
    const debouncedQuery = useDebounce(query.trim(), 500);

    const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useSearchTitles({
            query: debouncedQuery, // Use debounced query instead of raw query
            filters,
        });

    const results = data?.pages.flatMap((page) => page.results) ?? [];
    const totalResults = results.length;

    // Show loading skeleton while debouncing or loading
    const isDebouncing = query.trim() !== debouncedQuery;
    const showLoading = isLoading || isDebouncing;

    // IMPROVEMENT: User-friendly error messages
    const errorMessage = error ? getUserFriendlyErrorMessage(error) : null;

    const activeFilterLabels: string[] = [];
    if (filters.type && filters.type !== "all") {
        const labelByType: Record<NonNullable<TitleSearchFilters["type"]>, string> = {
            movie: "Movies",
            series: "Series",
            anime: "Anime",
            all: "All",
        };
        activeFilterLabels.push(labelByType[filters.type]);
    }
    if (filters.minYear) activeFilterLabels.push(`From ${filters.minYear}`);
    if (filters.maxYear) activeFilterLabels.push(`To ${filters.maxYear}`);
    if (filters.originalLanguage) activeFilterLabels.push(`Language: ${filters.originalLanguage}`);
    if (filters.genreIds?.length) activeFilterLabels.push(`${filters.genreIds.length} genre(s)`);

    const hasActiveFilters = activeFilterLabels.length > 0;

    // Empty state
    if (!debouncedQuery) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <Film className="h-16 w-16 text-muted-foreground mb-4" aria-hidden />
                <h3 className="text-lg font-semibold text-foreground mb-2">Search for Movies & Series</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                    Enter a title, actor, or keyword to discover content
                </p>
            </div>
        );
    }

    // Loading state with skeleton
    if (showLoading && !results.length) {
        return (
            <div className="space-y-4 px-4 py-4">
                {isDebouncing && (
                    <div className="text-sm text-muted-foreground text-center py-2">
                        Searching for "{query}"...
                    </div>
                )}
                <SearchSkeleton count={6} />
            </div>
        );
    }

    // Error state
    if (isError && errorMessage) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <AlertCircle className="h-16 w-16 text-red-500 mb-4" aria-hidden />
                <h3 className="text-lg font-semibold text-foreground mb-2">Search Failed</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">{errorMessage}</p>
                <Button onClick={() => window.location.reload()} variant="primary">
                    Try Again
                </Button>
            </div>
        );
    }

    // No results state
    if (!isLoading && results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <Film className="h-16 w-16 text-muted-foreground mb-4" aria-hidden />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Results Found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                    We couldn't find any titles matching "{debouncedQuery}"
                    {hasActiveFilters && " with the selected filters"}
                </p>
                {hasActiveFilters && onResetFilters && (
                    <Button onClick={onResetFilters} variant="secondary">
                        Clear Filters
                    </Button>
                )}
            </div>
        );
    }

    // Results
    return (
        <div className="flex flex-col h-full">
            {/* Results header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                        {totalResults} result{totalResults !== 1 ? "s" : ""}
                    </p>
                    {hasActiveFilters && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{activeFilterLabels.join(", ")}</span>
                            {onResetFilters && (
                                <button
                                    onClick={onResetFilters}
                                    className="text-sm text-primary hover:underline"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Virtualized results list */}
            <Virtuoso
                style={{ height: "100%" }}
                data={results}
                endReached={() => {
                    if (hasNextPage && !isFetchingNextPage) {
                        fetchNextPage();
                    }
                }}
                itemContent={(index, item) => (
                    <div className="px-4 py-2">
                        <TitleSearchResultRow key={item.id} item={item} />
                    </div>
                )}
                components={{
                    Footer: () =>
                        isFetchingNextPage ? (
                            <div className="py-4 text-center">
                                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : null,
                }}
            />
        </div>
    );
};

export default SearchTitlesTab;
