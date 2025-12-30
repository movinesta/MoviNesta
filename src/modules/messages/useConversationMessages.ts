import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  mapMessageRowToConversationMessage,
  type ConversationMessage,
  type MessageRow,
} from "./messageModel";
import { conversationMessagesQueryKey } from "./queryKeys";
import { useConversationRealtimeSubscription } from "./useConversationRealtimeSubscription";
import { useRealtimeQueryFallbackOptions } from "./useRealtimeQueryFallbackOptions";
import { stableSortMessages, upsertMessageRowIntoPages } from "./conversationMessagesCache";
import { getRealtimeNewRow, getStringField, hasConversationId } from "./realtimeGuards";
import { REALTIME_STALE_TIME_MS } from "./realtimeQueryDefaults";
import { MESSAGE_SELECT } from "./messageSelect";

const PAGE_SIZE = 40;

// react-virtuoso requires firstItemIndex >= 0.
// For chat-style "prepend older messages", start from a large index and decrement as you prepend.
const VIRTUOSO_START_INDEX = 100_000;

export type ConversationMessagesCursor = { createdAt: string; id: string };

export type ConversationMessagesPage = {
  items: ConversationMessage[];
  hasMore: boolean;
  cursor: ConversationMessagesCursor | null;
};

const buildOlderThanFilter = (cursor: ConversationMessagesCursor) => {
  // created_at is not guaranteed unique. Use (created_at, id) as a stable cursor.
  // Supabase OR syntax: "created_at.lt.X,and(created_at.eq.X,id.lt.Y)"
  const createdAt = cursor.createdAt;
  const id = cursor.id;
  return `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
};

const rowsToPage = (rows: MessageRow[]): ConversationMessagesPage => {
  const items = stableSortMessages((rows ?? []).map(mapMessageRowToConversationMessage));
  const hasMore = (rows ?? []).length >= PAGE_SIZE;
  const cursor = items.length ? { createdAt: items[0].createdAt, id: items[0].id } : null;
  return { items, hasMore, cursor };
};

export const useConversationMessages = (
  conversationId: string | null,
  options?: {
    onInsert?: (message: ConversationMessage) => void;
    onUpdate?: (message: ConversationMessage) => void;
  },
) => {
  const queryClient = useQueryClient();
  const queryKey = conversationMessagesQueryKey(conversationId);

  // Virtuoso anchor: start from a high index (>= 0) and decrement as we prepend older pages,
  // so the user's scroll position stays stable.
  const [firstItemIndex, setFirstItemIndex] = useState(VIRTUOSO_START_INDEX);

  // If realtime is unavailable, poll as a fallback.
  const { pollWhenRealtimeDown, onRealtimeStatus, refetchOptions } =
    useRealtimeQueryFallbackOptions(conversationId);

  // Avoid resubscribe loops by keeping options in a ref.
  const optionsRef = useRef<typeof options>(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const previousCountsRef = useRef<{ pages: number; total: number }>({ pages: 0, total: 0 });

  const infinite = useInfiniteQuery<ConversationMessagesPage>({
    queryKey,
    enabled: Boolean(conversationId),
    initialPageParam: null as ConversationMessagesCursor | null,
    ...refetchOptions,
    staleTime: REALTIME_STALE_TIME_MS,
    // refetchPage removed in v5.
    queryFn: async ({ pageParam }) => {
      if (!conversationId) return { items: [], hasMore: false, cursor: null };

      let query = supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (pageParam) {
        query = query.or(buildOlderThanFilter(pageParam as ConversationMessagesCursor));
      }

      const { data, error } = await query.limit(PAGE_SIZE);

      if (error) {
        const label = pageParam ? "older messages" : "messages";
        console.error(`[useConversationMessages] Failed to load ${label}`, error);
        throw new Error(error.message);
      }

      return rowsToPage((data as any as MessageRow[]) ?? []);
    },
    // TanStack Query v5 expects getNextPageParam to be a function.
    // We only page backwards (older messages), so there is no "next" page.
    getNextPageParam: () => undefined,
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.hasMore) return undefined;
      return firstPage.cursor ?? undefined;
    },
  });

  // Update Virtuoso anchoring when a previous page is prepended.
  useEffect(() => {
    const pages = infinite.data?.pages ?? [];
    const total = pages.reduce((sum, p) => sum + p.items.length, 0);
    const prev = previousCountsRef.current;

    if (pages.length === 0) {
      previousCountsRef.current = { pages: 0, total: 0 };
      setFirstItemIndex(VIRTUOSO_START_INDEX);
      return;
    }

    if (prev.pages === 0) {
      previousCountsRef.current = { pages: pages.length, total };
      setFirstItemIndex(VIRTUOSO_START_INDEX);
      return;
    }

    const added = total - prev.total;
    const pagesAdded = pages.length - prev.pages;

    if (added > 0 && pagesAdded > 0) {
      // Older page prepended.
      setFirstItemIndex((idx) => Math.max(0, idx - added));
    }

    previousCountsRef.current = { pages: pages.length, total };
  }, [infinite.data?.pages]);

  const createMessageRealtimeHandlers = useCallback(() => {
    if (!conversationId) return {};

    const handleMessageUpsert = (
      payload: RealtimePostgresChangesPayload<MessageRow>,
      kind: "insert" | "update",
    ) => {
      const rowUnknown = getRealtimeNewRow(payload);
      if (!hasConversationId(rowUnknown, conversationId)) return;
      const id = getStringField(rowUnknown, "id");
      if (!id) return;
      const row = rowUnknown as MessageRow;
      const mapped = mapMessageRowToConversationMessage(row);

      queryClient.setQueryData<InfiniteData<ConversationMessagesPage>>(queryKey, (existing) =>
        upsertMessageRowIntoPages(existing, row),
      );

      if (kind === "insert") {
        optionsRef.current?.onInsert?.(mapped);
      } else {
        optionsRef.current?.onUpdate?.(mapped);
      }
    };

    return {
      onStatus: onRealtimeStatus,
      onMessageInsert: (payload: RealtimePostgresChangesPayload<MessageRow>) => {
        handleMessageUpsert(payload, "insert");
      },
      onMessageUpdate: (payload: RealtimePostgresChangesPayload<MessageRow>) => {
        handleMessageUpsert(payload, "update");
      },
    };
  }, [conversationId, onRealtimeStatus, queryClient, queryKey]);

  useConversationRealtimeSubscription(conversationId, createMessageRealtimeHandlers, []);

  // Reset anchoring when conversation changes.
  useEffect(() => {
    setFirstItemIndex(VIRTUOSO_START_INDEX);
    previousCountsRef.current = { pages: 0, total: 0 };
  }, [conversationId]);

  const flatMessages = useMemo(() => {
    const pages = infinite.data?.pages ?? [];
    return pages.flatMap((p) => p.items);
  }, [infinite.data?.pages]);

  const loadOlder = useCallback(async () => {
    if (!conversationId) return;
    if (!infinite.hasPreviousPage) return;
    await infinite.fetchPreviousPage();
  }, [conversationId, infinite]);

  return useMemo(
    () => ({
      data: flatMessages,
      dataUpdatedAt: infinite.dataUpdatedAt,
      isLoading: infinite.isLoading,
      isFetching: infinite.isFetching,
      isError: infinite.isError,
      error: infinite.error,
      refetch: infinite.refetch,
      loadOlder,
      hasMore: Boolean(infinite.hasPreviousPage),
      isLoadingOlder: infinite.isFetchingPreviousPage,
      firstItemIndex,
      queryKey,
      pollWhenRealtimeDown,
    }),
    [
      flatMessages,
      infinite.dataUpdatedAt,
      infinite.isLoading,
      infinite.isFetching,
      infinite.isError,
      infinite.error,
      infinite.refetch,
      loadOlder,
      infinite.hasPreviousPage,
      infinite.isFetchingPreviousPage,
      firstItemIndex,
      queryKey,
      pollWhenRealtimeDown,
    ],
  );
};
