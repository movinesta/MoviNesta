import { useEffect, useMemo, useState } from "react";
import {
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from "@/lib/storage";

export const useConversationDraft = (params: {
  conversationId: string | null;
  storageKeyPrefix?: string;
  hydrate?: (draft: string) => void;
  debounceMs?: number;
}) => {
  const {
    conversationId,
    storageKeyPrefix = "messages:draft:",
    hydrate,
    debounceMs = 250,
  } = params;

  const storageKey = useMemo(
    () => (conversationId ? `${storageKeyPrefix}${conversationId}` : null),
    [conversationId, storageKeyPrefix],
  );

  const [draft, setDraft] = useState("");

  // Load draft when conversation changes (or clear when unset).
  useEffect(() => {
    if (!storageKey) {
      setDraft("");
      hydrate?.("");
      return;
    }

    const saved = safeLocalStorageGetItem(storageKey);
    const next = saved ?? "";
    setDraft(next);
    hydrate?.(next);
  }, [storageKey, hydrate]);

  // Save draft with debounce.
  useEffect(() => {
    if (!storageKey) return;

    const handle = window.setTimeout(() => {
      const value = draft.trim();
      if (value.length === 0) {
        safeLocalStorageRemoveItem(storageKey);
      } else {
        safeLocalStorageSetItem(storageKey, draft);
      }
    }, debounceMs);

    return () => window.clearTimeout(handle);
  }, [storageKey, debounceMs, draft]);

  const clearDraft = () => {
    if (storageKey) safeLocalStorageRemoveItem(storageKey);
    setDraft("");
    hydrate?.("");
  };

  return { draft, setDraft, clearDraft } as const;
};
