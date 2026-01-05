import { useCallback, useEffect, useMemo, useState } from "react";

import type { UiMessage } from "./useConversationUiMessages";
import { parseMessageText } from "./messageText";

const DEFAULT_MIN_QUERY_LEN = 2;

export type ConversationSearchState = {
  query: string;
  setQuery: (value: string) => void;

  isOpen: boolean;
  setIsOpen: (open: boolean) => void;

  matchCount: number;
  activeMatchNumber: number; // 1-based, 0 when no matches
  activeMatchIndex: number; // 0-based ordinal, -1 when none
  activeMessageId: string | null;

  isMatch: (messageId: string) => boolean;

  jumpNext: () => void;
  jumpPrev: () => void;
  jumpToFirst: () => void;
  clear: () => void;
  close: () => void;
};

export function useConversationSearch(args: {
  items: UiMessage[];
  onJumpToItemIndex?: (index: number) => void;
  minQueryLen?: number;
}): ConversationSearchState {
  const { items, onJumpToItemIndex, minQueryLen = DEFAULT_MIN_QUERY_LEN } = args;

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOrdinal, setActiveOrdinal] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const queryIsActive = normalizedQuery.length >= minQueryLen;

  const matchItemIndices = useMemo(() => {
    if (!queryIsActive) return [] as number[];

    const out: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.meta.deleted) continue;

      const text = parseMessageText(item.message.body);
      if (!text) continue;
      if (text.toLowerCase().includes(normalizedQuery)) out.push(i);
    }
    return out;
  }, [items, normalizedQuery, queryIsActive]);

  const matchMessageIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const idx of matchItemIndices) {
      const id = items[idx]?.message.id;
      if (id) set.add(id);
    }
    return set;
  }, [items, matchItemIndices]);

  const matchCount = matchItemIndices.length;

  useEffect(() => {
    // Reset the active pointer when query changes, but don't auto-scroll.
    setActiveOrdinal(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (matchCount === 0) return;
    if (activeOrdinal < 0) setActiveOrdinal(0);
    if (activeOrdinal > matchCount - 1) setActiveOrdinal(matchCount - 1);
  }, [activeOrdinal, matchCount]);

  const jumpToOrdinal = useCallback(
    (ordinal: number) => {
      if (matchCount === 0) return;
      const nextOrdinal = ((ordinal % matchCount) + matchCount) % matchCount;
      setActiveOrdinal(nextOrdinal);
      const targetIndex = matchItemIndices[nextOrdinal];
      if (typeof targetIndex === "number") {
        onJumpToItemIndex?.(targetIndex);
      }
    },
    [matchCount, matchItemIndices, onJumpToItemIndex],
  );

  const jumpNext = useCallback(() => {
    jumpToOrdinal(activeOrdinal + 1);
  }, [activeOrdinal, jumpToOrdinal]);

  const jumpPrev = useCallback(() => {
    jumpToOrdinal(activeOrdinal - 1);
  }, [activeOrdinal, jumpToOrdinal]);

  const jumpToFirst = useCallback(() => {
    jumpToOrdinal(0);
  }, [jumpToOrdinal]);

  const clear = useCallback(() => {
    setQuery("");
    setActiveOrdinal(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveOrdinal(0);
  }, []);

  const activeMessageId = useMemo(() => {
    if (matchCount === 0) return null;
    const idx = matchItemIndices[activeOrdinal];
    return items[idx]?.message.id ?? null;
  }, [activeOrdinal, items, matchCount, matchItemIndices]);

  return {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    matchCount,
    activeMatchNumber: matchCount === 0 ? 0 : activeOrdinal + 1,
    activeMatchIndex: matchCount === 0 ? -1 : activeOrdinal,
    activeMessageId,
    isMatch: (messageId: string) => matchMessageIdSet.has(messageId),
    jumpNext,
    jumpPrev,
    jumpToFirst,
    clear,
    close,
  };
}
