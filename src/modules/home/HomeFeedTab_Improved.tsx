// Improved HomeFeedTab with error handling and skeleton loaders
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { CardGridSkeleton } from "@/components/skeletons/Skeletons";
import { getUserFriendlyErrorMessage, retryWithBackoff } from "@/lib/errorHandling";
import { Users, Activity } from "lucide-react";

interface FeedEvent {
    id: string;
    type: string;
    userId: string;
    userName: string;
    userAvatar: string | null;
    mediaId: string;
    mediaTitle: string;
    mediaPoster: string | null;
    createdAt: string;
    rating?: number;
    status?: string;
}

interface HomeFeedTabProps {
    isFiltersSheetOpen: boolean;
    onFiltersSheetOpenChange: (open: boolean) => void;
    quickFilter: "all" | "follows" | "reviews";
}

const HomeFeedTab: React.FC<HomeFeedTabProps> = ({
    isFiltersSheetOpen,
    onFiltersSheetOpenChange,
    quickFilter,
}) => {
    void isFiltersSheetOpen;
    void onFiltersSheetOpenChange;
    void quickFilter;
    const { user } = useAuth();

    const { data: feedEvents, isLoading, isError, error, refetch } = useQuery<FeedEvent[]>({
        queryKey: ["home-feed", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // IMPROVEMENT: Use retry logic for failed requests
            return await retryWithBackoff(
                async () => {
                    const { data, error } = await supabase.rpc("get_home_feed_v2", {
                        p_user_id: user.id,
                        p_limit: 50,
                    });

                    if (error) throw error;
                    return (data || []) as FeedEvent[];
                },
                {
                    maxRetries: 2,
                    initialDelay: 1000,
                    onRetry: (attempt) => {
                        console.log(`[HomeFeedTab] Retrying feed fetch, attempt ${attempt}`);
                    },
                }
            );
        },
        enabled: !!user?.id,
        staleTime: 2 * 60 * 1000, // 2 minutes
        cacheTime: 5 * 60 * 1000, // 5 minutes
        retry: false, // We handle retries manually
    });

    // Loading state with skeleton
    if (isLoading) {
        return (
            <div className="space-y-4 px-4 py-4">
                <div className="text-sm text-muted-foreground">Loading your feed...</div>
                <CardGridSkeleton count={8} />
            </div>
        );
    }

    // Error state
    if (isError) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        return (
            <div className="px-4 py-4">
                <ErrorState message={errorMessage} onRetry={() => refetch()} />
            </div>
        );
    }

    // Empty state
    if (!feedEvents || feedEvents.length === 0) {
        return (
            <div className="px-4 py-4">
                <EmptyState
                    icon={Users}
                    title="Your Feed is Empty"
                    description="Follow friends to see their activity and recommendations here"
                    action={{
                        label: "Find People",
                        onClick: () => (window.location.href = "/search?tab=people"),
                    }}
                />
            </div>
        );
    }

    // Feed content
    return (
        <div className="space-y-4 px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4" aria-hidden />
                <span>{feedEvents.length} recent activities</span>
            </div>

            <div className="space-y-3">
                {feedEvents.map((event) => (
                    <div
                        key={event.id}
                        className="flex gap-3 p-3 rounded-2xl border border-border bg-background/60 hover:bg-card/80 transition-colors"
                    >
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                            {event.userAvatar ? (
                                <img
                                    src={event.userAvatar}
                                    alt={event.userName}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <Users className="w-5 h-5 text-muted-foreground" aria-hidden />
                                </div>
                            )}
                        </div>

                        {/* Event Content */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                                <span className="font-medium">{event.userName}</span>{" "}
                                <span className="text-muted-foreground">
                                    {event.type === "rating" && `rated`}
                                    {event.type === "status" && `updated status for`}
                                    {event.type === "review" && `reviewed`}
                                </span>{" "}
                                <span className="font-medium">{event.mediaTitle}</span>
                            </p>

                            {event.rating && (
                                <p className="text-xs text-muted-foreground mt-1">⭐ {event.rating}/10</p>
                            )}

                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(event.createdAt).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Media Poster */}
                        {event.mediaPoster && (
                            <div className="flex-shrink-0">
                                <img
                                    src={event.mediaPoster}
                                    alt={event.mediaTitle}
                                    className="w-12 h-16 rounded object-cover"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HomeFeedTab;
