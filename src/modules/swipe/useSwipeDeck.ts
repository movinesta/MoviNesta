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
  imdbRating?: number | null;
  rtTomatoMeter?: number | null;
  source?: SwipeDeckKind;
};

export type SwipeDeckKind = "for-you" | "from-friends" | "trending";
export type SwipeDeckKindOrCombined = SwipeDeckKind | "combined";

interface SwipeDeckResponse {
  cards: SwipeCardData[];
}

interface SwipeEventPayload {
  cardId: string;
  direction: SwipeDirection;
  rating?: number | null;
  inWatchlist?: boolean | null;
  sourceOverride?: SwipeDeckKind;
}

function buildInterleavedDeck(lists: SwipeCardData[][], limit: number): SwipeCardData[] {
  const maxLength = Math.max(...lists.map((list) => list.length));
  const interleaved: SwipeCardData[] = [];

  for (let i = 0; i < maxLength; i += 1) {
    for (const list of lists) {
      const card = list[i];
      if (card) {
        interleaved.push(card);
        if (interleaved.length >= limit) return interleaved;
      }
    }
  }

  return interleaved.slice(0, limit);
}

export function useSwipeDeck(kind: SwipeDeckKindOrCombined, options?: { limit?: number }) {
  const limit = options?.limit ?? 40;

  const fnName =
    kind === "for-you"
      ? "swipe-for-you"
      : kind === "from-friends"
        ? "swipe-from-friends"
        : kind === "trending"
          ? "swipe-trending"
          : null;

  const loadDeck = async (): Promise<SwipeDeckResponse> => {
    if (kind !== "combined" && fnName) {
      const { data, error } = await supabase.functions.invoke<SwipeDeckResponse>(fnName, {
        body: { limit },
      });

      if (error) {
        console.warn("[useSwipeDeck] error from", fnName, error);
        return { cards: [] };
      }

      return {
        cards: (data?.cards ?? []).map((card) => ({ ...card, source: kind })),
      };
    }

    const [forYou, friends, trending] = await Promise.all(
      ["swipe-for-you", "swipe-from-friends", "swipe-trending"].map((fn) =>
        supabase.functions.invoke<SwipeDeckResponse>(fn, {
          body: { limit: Math.max(12, Math.ceil(limit / 2)) },
        }),
      ),
    );

    const collected: SwipeCardData[][] = [
      (forYou.data?.cards ?? []).map((card) => ({ ...card, source: "for-you" })),
      (friends.data?.cards ?? []).map((card) => ({ ...card, source: "from-friends" })),
      (trending.data?.cards ?? []).map((card) => ({ ...card, source: "trending" })),
    ];

    if (forYou.error) console.warn("[useSwipeDeck] error from swipe-for-you", forYou.error);
    if (friends.error) console.warn("[useSwipeDeck] error from swipe-from-friends", friends.error);
    if (trending.error) console.warn("[useSwipeDeck] error from swipe-trending", trending.error);

    return {
      cards: buildInterleavedDeck(collected, limit),
    };
  };

  // LOAD CARDS
  const deckQuery = useQuery({
    queryKey: ["swipe-deck", kind, { limit }],
    queryFn: loadDeck,
  });

  // SEND SWIPE → swipe-event
  const swipeMutation = useMutation({
    mutationFn: async ({ cardId, direction, rating, inWatchlist, sourceOverride }: SwipeEventPayload) => {
      const { error } = await supabase.functions.invoke("swipe-event", {
        body: {
          titleId: cardId,
          direction,
          source: sourceOverride ?? (kind === "combined" ? undefined : kind),
          rating,
          inWatchlist,
        },
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
