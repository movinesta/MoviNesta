// Improved SearchPeopleTab with debouncing and error handling
import React from "react";
import { Link } from "react-router-dom";
import { User, MessageCircle, AlertCircle } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchSkeleton } from "@/components/skeletons/Skeletons";
import { EmptyState, ErrorState, NoResultsState } from "@/components/EmptyState";
import { getUserFriendlyErrorMessage } from "@/lib/errorHandling";
import { useSearchPeople } from "./useSearchPeople";
import { Button } from "@/components/ui/Button";

interface SearchPeopleTabProps {
    query: string;
}

const SearchPeopleTab: React.FC<SearchPeopleTabProps> = ({ query }) => {
    // IMPROVEMENT: Debounce search query to reduce API calls
    const debouncedQuery = useDebounce(query.trim(), 500);

    const { data, isLoading, isError, error } = useSearchPeople(debouncedQuery);

    // Show loading skeleton while debouncing or loading
    const isDebouncing = query.trim() !== debouncedQuery;
    const showLoading = isLoading || isDebouncing;

    // IMPROVEMENT: User-friendly error messages
    const errorMessage = error ? getUserFriendlyErrorMessage(error) : null;

    // Empty state
    if (!debouncedQuery) {
        return (
            <EmptyState
                icon={User}
                title="Search for People"
                description="Find friends, discover new profiles, and connect with the community"
            />
        );
    }

    // Loading state
    if (showLoading && !data?.length) {
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
        return <ErrorState message={errorMessage} onRetry={() => window.location.reload()} />;
    }

    // No results state
    if (!isLoading && (!data || data.length === 0)) {
        return <NoResultsState query={debouncedQuery} />;
    }

    // Results
    return (
        <div className="space-y-3 px-4 py-4">
            <div className="text-sm font-medium text-foreground mb-4">
                {data?.length || 0} result{data?.length !== 1 ? "s" : ""}
            </div>

            {data?.map((person) => (
                <div
                    key={person.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-background/60 hover:bg-card/80 transition-colors"
                >
                    {/* Avatar */}
                    <Link to={`/profile/${person.username || person.id}`} className="flex-shrink-0">
                        {person.avatarUrl ? (
                            <img
                                src={person.avatarUrl}
                                alt={person.displayName || person.username || "User"}
                                className="w-12 h-12 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-6 h-6 text-muted-foreground" aria-hidden />
                            </div>
                        )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <Link
                            to={`/profile/${person.username || person.id}`}
                            className="block hover:underline"
                        >
                            <p className="font-medium text-foreground truncate">
                                {person.displayName || person.username || "Anonymous"}
                            </p>
                            {person.username && (
                                <p className="text-sm text-muted-foreground truncate">@{person.username}</p>
                            )}
                        </Link>
                        {person.bio && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{person.bio}</p>
                        )}
                    </div>

                    {/* Action */}
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            // Navigate to messages or follow
                            window.location.href = `/messages?user=${person.id}`;
                        }}
                    >
                        <MessageCircle className="w-4 h-4" aria-hidden />
                    </Button>
                </div>
            ))}
        </div>
    );
};

export default SearchPeopleTab;
