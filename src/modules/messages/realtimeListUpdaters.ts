import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { removeFromList, upsertIntoList } from "./cacheListHelpers";
import {
  getRealtimeNewRow,
  getRealtimeOldRow,
  getStringField,
  hasConversationId,
} from "./realtimeGuards";

type SortFn<T> = (a: T, b: T) => number;

type ConversationScopedUpsertArgs<Row, Item> = {
  conversationId: string;
  queryClient: QueryClient;
  queryKey: QueryKey;
  mapRow: (row: Row) => Item;
  /** Stable identity for the list item. */
  key: (item: Item) => string;
  /** Optional sort function for the list. */
  sort?: SortFn<Item>;
  /**
   * Additional guard to drop irrelevant rows before casting (e.g., filter by message_id).
   */
  extraGuard?: (rowUnknown: unknown) => boolean;
  /**
   * Returns a required id-like field from the row payload. Used only as a presence check.
   * Defaults to reading `id`.
   */
  getRequiredId?: (rowUnknown: unknown) => string | null;
};

/**
 * Factory for a realtime handler that upserts a conversation-scoped row into a cached list.
 */
export const createConversationScopedUpsertIntoListHandler = <
  Row extends Record<string, any>,
  Item,
>(
  args: ConversationScopedUpsertArgs<Row, Item>,
) => {
  return (payload: RealtimePostgresChangesPayload<Row>) => {
    const rowUnknown = getRealtimeNewRow(payload);
    if (!hasConversationId(rowUnknown, args.conversationId)) return;
    if (args.extraGuard && !args.extraGuard(rowUnknown)) return;

    const requiredId = args.getRequiredId
      ? args.getRequiredId(rowUnknown)
      : getStringField(rowUnknown, "id");
    if (!requiredId) return;

    const row = rowUnknown as Row;
    const mapped = args.mapRow(row);

    args.queryClient.setQueryData<Item[]>(args.queryKey, (existing) =>
      upsertIntoList(existing, mapped, { key: args.key, sort: args.sort }),
    );
  };
};

type RealtimeDeleteArgs<Item> = {
  queryClient: QueryClient;
  queryKey: QueryKey;
  /** Stable identity for the list item. */
  key: (item: Item) => string;
  /**
   * Returns the row id from the payload. Defaults to reading `id`.
   */
  getRowId?: (rowUnknown: unknown) => string | null;
  /**
   * If we can't safely identify the row to delete, invalidate instead.
   */
  invalidateWhenMissingId?: boolean;
};

/**
 * Factory for a realtime handler that deletes a row from a cached list.
 */
export const createRealtimeDeleteFromListHandler = <Row extends Record<string, any>, Item>(
  args: RealtimeDeleteArgs<Item>,
) => {
  return (payload: RealtimePostgresChangesPayload<Row>) => {
    const rowUnknown = getRealtimeOldRow(payload);
    const id = args.getRowId ? args.getRowId(rowUnknown) : getStringField(rowUnknown, "id");

    if (!id) {
      if (args.invalidateWhenMissingId !== false) {
        args.queryClient.invalidateQueries({ queryKey: args.queryKey });
      }
      return;
    }

    args.queryClient.setQueryData<Item[]>(args.queryKey, (existing) =>
      removeFromList(existing, id, { key: args.key }),
    );
  };
};
