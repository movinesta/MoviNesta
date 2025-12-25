import { useEffect, useState } from "react";

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

  const [draft, setDraft] = useState("");

  // Load draft when conversation changes.
  useEffect(() => {
    if (!conversationId) return;
    const key = `${storageKeyPrefix}${conversationId}`;
    const saved = window.localStorage.getItem(key);
    if (saved != null && saved !== draft) {
      setDraft(saved);
      hydrate?.(saved);
    }
  }, [conversationId]);

  // Save draft with debounce.
  useEffect(() => {
    if (!conversationId) return;
    const key = `${storageKeyPrefix}${conversationId}`;

    const handle = window.setTimeout(() => {
      if (draft.trim().length === 0) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, draft);
      }
    }, debounceMs);

    return () => window.clearTimeout(handle);
  }, [conversationId, debounceMs, draft, storageKeyPrefix]);

  const clearDraft = () => setDraft("");

  return { draft, setDraft, clearDraft } as const;
};
