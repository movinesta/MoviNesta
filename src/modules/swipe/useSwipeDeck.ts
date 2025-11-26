import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type SwipeDirection = "like" | "dislike" | "skip";

export type SwipeCardData = {
  id: string;
  title: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  tagline?: string | null;
  mood?: string | null;
  vibeTag?: string | null;
  type?: string | null;
  posterUrl?: string | null;
  friendLikesCount?: number | null;
  topFriendName?: string | null;
  topFriendInitials?: string | null;
  topFriendReviewSnippet?: string | null;
  initialRating?: number | null;
  initiallyInWatchlist?: boolean;
};

export type SwipeDeckKind = "for-you" | "from-friends" | "trending";

interface SwipeDeckResponse {
  cards: SwipeCardData[];
}

interface SwipeEventPayload {
  cardId: string;
  direction: SwipeDirection;
  rating?: number | null;
  inWatchlist?: boolean | null;
}

export function useSwipeDeck(kind: SwipeDeckKind, options?: { limit?: number }) {
  const limit = options?.limit ?? 40;

  const fnName =
    kind === "for-you"
      ? "swipe-for-you"
      : kind === "from-friends"
        ? "swipe-from-friends"
        : "swipe-trending";

  // LOAD CARDS
  const deckQuery = useQuery({
    queryKey: ["swipe-deck", kind, { limit }],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SwipeDeckResponse>(fnName, {
        body: { limit },
      });

      if (error) {
        console.warn("[useSwipeDeck] error from", fnName, error);
        return { cards: [] };
      }

      return data ?? { cards: [] };
    },
  });

  // SEND SWIPE → swipe-event
  const swipeMutation = useMutation({
    mutationFn: async ({ cardId, direction, rating, inWatchlist }: SwipeEventPayload) => {
      const { error } = await supabase.functions.invoke("swipe-event", {
        body: { titleId: cardId, direction, source: kind, rating, inWatchlist },
      });

      if (error) {
        console.warn("[useSwipeDeck] swipe-event error", error);
      }
    },
  });

  return {
    cards: deckQuery.data?.cards ?? [],
    isLoading: deckQuery.isLoading,
    isError: deckQuery.isError,
    swipe: swipeMutation.mutate,
    swipeAsync: swipeMutation.mutateAsync,
  };
}
