// Improved MessagesPage with retry logic and skeleton loaders
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { SearchSkeleton } from "@/components/skeletons/Skeletons";
import { getUserFriendlyErrorMessage, retryWithBackoff } from "@/lib/errorHandling";
import { MessageCircle, Inbox } from "lucide-react";
import { Link } from "react-router-dom";

interface Conversation {
    id: string;
    otherUserId: string;
    otherUserName: string | null;
    otherUserAvatar: string | null;
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
}

const MessagesPage: React.FC = () => {
    const { user } = useAuth();

    const { data: conversations, isLoading, isError, error, refetch } = useQuery<Conversation[]>({
        queryKey: ["conversations", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // Use retry logic for failed requests
            return await retryWithBackoff(
                async () => {
                    const { data, error } = await supabase
                        .from("conversations")
                        .select(`
              id,
              participant1_id,
              participant2_id,
              last_message_at,
              last_message_preview
            `)
                        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`)
                        .order("last_message_at", { ascending: false })
                        .limit(50);

                    if (error) throw error;

                    // Get other user details
                    const otherUserIds = (data || []).map((conv: any) =>
                        conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id
                    );

                    if (otherUserIds.length === 0) return [];

                    const { data: profiles } = await supabase
                        .from("profiles_public")
                        .select("id, username, display_name, avatar_url")
                        .in("id", otherUserIds);

                    const profileMap = new Map(
                        (profiles || []).map((p: any) => [p.id, p])
                    );

                    return (data || []).map((conv: any) => {
                        const otherUserId = conv.participant1_id === user.id ? conv.participant2_id : conv.participant1_id;
                        const otherUser = profileMap.get(otherUserId);

                        return {
                            id: conv.id,
                            otherUserId,
                            otherUserName: otherUser?.display_name || otherUser?.username || "Unknown",
                            otherUserAvatar: otherUser?.avatar_url || null,
                            lastMessage: conv.last_message_preview || null,
                            lastMessageAt: conv.last_message_at || null,
                            unreadCount: 0, // TODO: Calculate unread count
                        };
                    });
                },
                {
                    maxRetries: 3,
                    initialDelay: 1000,
                    onRetry: (attempt) => {
                        console.log(`[MessagesPage] Retrying conversations fetch, attempt ${attempt}`);
                    },
                }
            );
        },
        enabled: !!user?.id,
        staleTime: 1 * 60 * 1000, // 1 minute
        cacheTime: 5 * 60 * 1000, // 5 minutes
        refetchInterval: 30 * 1000, // Refetch every 30 seconds
    });

    // Loading state
    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Messages</h1>
                <SearchSkeleton count={5} />
            </div>
        );
    }

    // Error state
    if (isError) {
        const errorMessage = getUserFriendlyErrorMessage(error);
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Messages</h1>
                <ErrorState message={errorMessage} onRetry={() => refetch()} />
            </div>
        );
    }

    // Empty state
    if (!conversations || conversations.length === 0) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">Messages</h1>
                <EmptyState
                    icon={Inbox}
                    title="No Messages Yet"
                    description="Start a conversation by visiting someone's profile and clicking the message button"
                    action={{
                        label: "Find People",
                        onClick: () => (window.location.href = "/search?tab=people"),
                    }}
                />
            </div>
        );
    }

    // Conversations list
    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Messages</h1>

            <div className="space-y-2">
                {conversations.map((conversation) => (
                    <Link
                        key={conversation.id}
                        to={`/messages/${conversation.id}`}
                        className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background hover:bg-card transition-colors"
                    >
                        {/* Avatar */}
                        {conversation.otherUserAvatar ? (
                            <img
                                src={conversation.otherUserAvatar}
                                alt={conversation.otherUserName || "User"}
                                className="w-12 h-12 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                                <MessageCircle className="w-6 h-6 text-muted-foreground" aria-hidden />
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-foreground truncate">
                                    {conversation.otherUserName}
                                </p>
                                {conversation.lastMessageAt && (
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(conversation.lastMessageAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                            {conversation.lastMessage && (
                                <p className="text-sm text-muted-foreground truncate">
                                    {conversation.lastMessage}
                                </p>
                            )}
                        </div>

                        {/* Unread badge */}
                        {conversation.unreadCount > 0 && (
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                                {conversation.unreadCount}
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default MessagesPage;
