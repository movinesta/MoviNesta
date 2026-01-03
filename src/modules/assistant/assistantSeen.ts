const SEEN_KEY_PREFIX = "assistant_seen_suggestion_v1";

function keyFor(surface: string, contextKey: string) {
  // Context key can be long; keep storage keys reasonable.
  const short = contextKey.length > 120 ? contextKey.slice(0, 120) : contextKey;
  return `${SEEN_KEY_PREFIX}:${surface}:${short}`;
}

export function getSeenSuggestionId(surface: string, contextKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyFor(surface, contextKey));
  } catch {
    return null;
  }
}

export function setSeenSuggestionId(surface: string, contextKey: string, suggestionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(surface, contextKey), suggestionId);
  } catch {
    // ignore
  }
}
