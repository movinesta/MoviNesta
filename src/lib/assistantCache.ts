// src/lib/assistantCache.ts
//
// Cache the assistant DM identity (assistant profile + conversationId).
// This avoids hardcoding assistant UUIDs in the client and makes DM detection reliable.
//
// Storage is best-effort. If parsing fails, we silently ignore the cache.

export type AssistantCache = {
  conversationId: string;
  assistant: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  updatedAt: number;
};

const KEY = "movinesta.assistantCache.v1";

const EVENT = "movinesta:assistant-cache";

function emitChange() {
  try {
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // ignore
  }
}

export function getAssistantCache(): AssistantCache | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as AssistantCache;
    if (!obj?.conversationId || !obj?.assistant?.id) return null;
    return obj;
  } catch {
    return null;
  }
}

export function setAssistantCache(next: AssistantCache) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  emitChange();
}

export function clearAssistantCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }

  emitChange();
}
