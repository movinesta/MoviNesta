// Improved ProfilePage with error boundary and skeleton loaders
import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { ProfileSkeleton } from "@/components/skeletons/Skeletons";
import { getUserFriendlyErrorMessage, retryWithBackoff } from "@/lib/errorHandling";
import { User, Settings } from "lucide-react";

interface Profile {
    id: string;
    username: string | null;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    followersCount: number;
    followingCount: number;
    ratingsCount: number;
    reviewsCount: number;
}

const ProfilePage: React.FC = () => {
    const { username } = useParams<{ username: string }>();
    const { user } = useAuth();

    const { data: profile, isLoading, isError, error, refetch } = useQuery<Profile>({
        queryKey: ["profile", username],
        queryFn: async () => {
            if (!username) throw new Error("Username is required");

            // Use retry logic for failed requests
            return await retryWithBackoff(
                async () => {
                    const { data, error } = await supabase
                        .from("profiles_public")
                        .select(`
              id,
              username,
              display_name,
              bio,
              avatar_url
            `)
                        .eq("username", username)
                        .single();

                    if (error) throw error;
                    if (!data) throw new Error("Profile not found");

                    // Fetch stats
                    const [followersResult, followingResult, ratingsResult, reviewsResult] = await Promise.all([
                        supabase.from("follows").select("id", { count: "exact", head: true }).eq("followed_id", data.id),
                        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", data.id),
                        supabase.from("ratings").select("id", { count: "exact", head: true }).eq("user_id", data.id),
                        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", data.id),
                    ]);

                    return {
                        id: data.id,
                        username: data.username,
                        displayName: data.display_name,
                        bio: data.bio,
                        avatarUrl: data.avatar_url,
                        followersCount: followersResult.count || 0,
                        followingCount: followingResult.count || 0,
                        ratingsCount: ratingsResult.count || 0,
                        reviewsCount: reviewsResult.count || 0,
                    };
                },
                {
                    maxRetries: 2,
                    initialDelay: 1000,
                }
            );
        },
        enabled: !!username,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    });

    // Loading state
    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <ProfileSkeleton />
            </div>
        );
    }

    // Error state
    if (isError) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <ErrorState message={errorMessage} onRetry={() => refetch()} />
            </div>
        );
    }

    // Not found state
    if (!profile) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <EmptyState
                    icon={User}
                    title="Profile Not Found"
                    description={`We couldn't find a profile with username "${username}"`}
                    action={{
                        label: "Go Home",
                        onClick: () => (window.location.href = "/"),
                    }}
                />
            </div>
        );
    }

    const isOwnProfile = user?.id === profile.id;

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Profile Header */}
            <div className="flex items-start gap-6 mb-8">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    {profile.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt={profile.displayName || profile.username || "User"}
                            className="w-24 h-24 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-12 h-12 text-muted-foreground" aria-hidden />
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                {profile.displayName || profile.username || "Anonymous"}
                            </h1>
                            {profile.username && (
                                <p className="text-muted-foreground">@{profile.username}</p>
                            )}
                        </div>
                        {isOwnProfile && (
                            <a
                                href="/settings/profile"
                                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-2"
                            >
                                <Settings className="w-4 h-4" aria-hidden />
                                Edit Profile
                            </a>
                        )}
                    </div>

                    {profile.bio && (
                        <p className="text-foreground mb-4">{profile.bio}</p>
                    )}

                    {/* Stats */}
                    <div className="flex gap-6">
                        <div>
                            <div className="text-2xl font-bold text-foreground">{profile.followersCount}</div>
                            <div className="text-sm text-muted-foreground">Followers</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">{profile.followingCount}</div>
                            <div className="text-sm text-muted-foreground">Following</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">{profile.ratingsCount}</div>
                            <div className="text-sm text-muted-foreground">Ratings</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-foreground">{profile.reviewsCount}</div>
                            <div className="text-sm text-muted-foreground">Reviews</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs would go here */}
            <div className="border-t border-border pt-6">
                <p className="text-muted-foreground text-center">
                    Profile tabs (Activity, Diary, etc.) would be displayed here
                </p>
            </div>
        </div>
    );
};

export default ProfilePage;
