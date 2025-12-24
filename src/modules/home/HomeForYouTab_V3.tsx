// Updated HomeForYouTab.tsx - V3 Recommendation Integration
// This file replaces the client-side recommendation logic with server-side V3 function calls

import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Film, Sparkles, Users, Zap } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import {
    TonightPickSkeleton,
    CarouselsSkeleton,
    EmptyTonightPickState,
    EmptyForYouState,
} from "./HomeForYouSkeletons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

// Generate or retrieve session ID
const getSessionId = (): string => {
    const SESSION_KEY = "movinesta_session_id";
    let sessionId = sessionStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
};

type RecommendationSectionKind = "discover" | "trending" | "similar_to" | "continue";

interface RecommendationItem {
    media_item_id: string;
    score: number;
    match_reason: string;
    is_exploration: boolean;
    diversity_rank: number;
    media_data: {
        id: string;
        kind: string;
        title: string;
        year: number;
        poster: string | null;
        backdrop: string | null;
        imdb_rating: number | null;
        rt_rating: number | null;
        runtime: number | null;
    };
}

interface RecommendationSection {
    id: string;
    kind: RecommendationSectionKind;
    title: string;
    subtitle?: string;
    items: RecommendationItem[];
}

interface UseRecommendationsResult {
    isLoading: boolean;
    error: string | null;
    sections: RecommendationSection[];
}

/**
 * Fetch recommendations using V3 function
 */
const fetchRecommendationsV3 = async (
    userId: string,
    sessionId: string,
    section: RecommendationSectionKind = "discover",
    limit: number = 20
): Promise<RecommendationItem[]> => {
    const { data, error } = await supabase.rpc("get_personalized_recommendations_v3", {
        p_user_id: userId,
        p_session_id: sessionId,
        p_section: section,
        p_limit: limit,
        p_exclude_watched: true,
        p_quality_floor_imdb: 6.5,
        p_quality_floor_rt: 60.0,
        p_runtime_preference: "any",
        p_context: {},
    });

    if (error) {
        console.error(`[V3 Recommendations] Error fetching ${section}:`, error);
        throw error;
    }

    return data || [];
};

/**
 * Hook for V3 recommendations
 */
const useRecommendations = (): UseRecommendationsResult => {
    const { user } = useAuth();
    const sessionId = useMemo(() => getSessionId(), []);

    const { data, isLoading, error } = useQuery({
        queryKey: ["recommendations-v3", user?.id, sessionId],
        queryFn: async () => {
            if (!user?.id) throw new Error("User not authenticated");

            // Fetch multiple sections in parallel
            const [discover, trending, continueWatching] = await Promise.allSettled([
                fetchRecommendationsV3(user.id, sessionId, "discover", 20),
                fetchRecommendationsV3(user.id, sessionId, "trending", 12),
                fetchRecommendationsV3(user.id, sessionId, "continue", 10),
            ]);

            const sections: RecommendationSection[] = [];

            // Discover section
            if (discover.status === "fulfilled" && discover.value.length > 0) {
                sections.push({
                    id: "discover",
                    kind: "discover",
                    title: "Recommended for You",
                    subtitle: "Personalized picks based on your taste",
                    items: discover.value,
                });
            }

            // Trending section
            if (trending.status === "fulfilled" && trending.value.length > 0) {
                sections.push({
                    id: "trending",
                    kind: "trending",
                    title: "Trending Now",
                    subtitle: "What's hot in the last 72 hours",
                    items: trending.value,
                });
            }

            // Continue watching section
            if (continueWatching.status === "fulfilled" && continueWatching.value.length > 0) {
                sections.push({
                    id: "continue",
                    kind: "continue",
                    title: "Continue Watching",
                    subtitle: "Pick up where you left off",
                    items: continueWatching.value,
                });
            }

            return sections;
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 2,
    });

    return {
        isLoading,
        error: error ? (error as Error).message : null,
        sections: data || [],
    };
};

/**
 * Main HomeForYouTab component
 */
const HomeForYouTab = () => {
    const { isLoading, error, sections } = useRecommendations();

    if (isLoading) {
        return (
            <div className="space-y-8 pb-12">
                <TonightPickSkeleton />
                <CarouselsSkeleton count={3} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="text-center max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Couldn't Load Recommendations
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (sections.length === 0) {
        return <EmptyForYouState />;
    }

    return (
        <div className="space-y-8 pb-12">
            {sections.map((section) => (
                <RecommendationSectionRow key={section.id} section={section} />
            ))}
        </div>
    );
};

/**
 * Section row component
 */
interface RecommendationSectionRowProps {
    section: RecommendationSection;
}

const RecommendationSectionRow: React.FC<RecommendationSectionRowProps> = ({ section }) => {
    const sectionIcon = {
        discover: Sparkles,
        trending: Zap,
        similar_to: Film,
        continue: Clock,
    }[section.kind];

    const Icon = sectionIcon || Sparkles;

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-blue-600" aria-hidden />
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {section.title}
                        </h2>
                        {section.subtitle && (
                            <p className="text-sm text-gray-600">{section.subtitle}</p>
                        )}
                    </div>
                </div>
                <Link
                    to={`/recommendations/${section.kind}`}
                    className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                >
                    See all
                    <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-4 px-4 sm:px-6 pb-2">
                    {section.items.map((item) => (
                        <RecommendationCard key={item.media_item_id} item={item} sectionKind={section.kind} />
                    ))}
                </div>
            </div>
        </section>
    );
};

/**
 * Recommendation card component
 */
interface RecommendationCardProps {
    item: RecommendationItem;
    sectionKind: RecommendationSectionKind;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ item, sectionKind }) => {
    const { media_data, match_reason, is_exploration, score } = item;

    return (
        <Link
            to={`/title/${media_data.id}`}
            className="group flex-shrink-0 w-40 sm:w-48 space-y-2"
        >
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200">
                {media_data.poster ? (
                    <img
                        src={media_data.poster}
                        alt={media_data.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-12 h-12 text-gray-400" aria-hidden />
                    </div>
                )}

                {/* Exploration badge */}
                {is_exploration && (
                    <div className="absolute top-2 right-2">
                        <Chip size="sm" variant="primary">
                            <Sparkles className="w-3 h-3" aria-hidden />
                            New
                        </Chip>
                    </div>
                )}

                {/* Rating badge */}
                {media_data.imdb_rating && (
                    <div className="absolute bottom-2 left-2">
                        <Chip size="sm" variant="secondary">
                            ⭐ {media_data.imdb_rating.toFixed(1)}
                        </Chip>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <h3 className="font-medium text-sm text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {media_data.title}
                </h3>
                {media_data.year && (
                    <p className="text-xs text-gray-600">{media_data.year}</p>
                )}
                {match_reason && (
                    <p className="text-xs text-gray-500 line-clamp-2">{match_reason}</p>
                )}
            </div>
        </Link>
    );
};

export default HomeForYouTab;
export { TonightPickSkeleton, CarouselsSkeleton } from "./HomeForYouSkeletons";
