const DISMISSED_KEY_PREFIX = "moviNesta.suggestedPeople.dismissed.v1";

const keyForUser = (viewerId: string) => `${DISMISSED_KEY_PREFIX}:${viewerId}`;

export const loadDismissedSuggestedPeople = (viewerId: string): string[] => {
  try {
    const raw = localStorage.getItem(keyForUser(viewerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
};

export const addDismissedSuggestedPerson = (viewerId: string, profileId: string) => {
  const existing = new Set(loadDismissedSuggestedPeople(viewerId));
  existing.add(profileId);
  try {
    localStorage.setItem(keyForUser(viewerId), JSON.stringify(Array.from(existing)));
  } catch {
    // ignore storage failures
  }
};

export const clearDismissedSuggestedPeople = (viewerId: string) => {
  try {
    localStorage.removeItem(keyForUser(viewerId));
  } catch {
    // ignore
  }
};
