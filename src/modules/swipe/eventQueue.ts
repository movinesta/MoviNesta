import type { SendMediaSwipeEventInput } from "./mediaSwipeApi";

const STORAGE_KEY = "movi_swipe_event_queue_v1";

type QueuedEvent = SendMediaSwipeEventInput & { queuedAt: number };

function safeParse(raw: string | null): QueuedEvent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(Boolean) as QueuedEvent[];
  } catch {
    return [];
  }
}

export function loadQueuedEvents(): QueuedEvent[] {
  return safeParse(typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
}

export function enqueueSwipeEvent(ev: SendMediaSwipeEventInput): void {
  if (typeof localStorage === "undefined") return;
  const queue = loadQueuedEvents();
  queue.push({ ...ev, queuedAt: Date.now() });

  // cap growth
  const capped = queue.slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
}

export function removeQueuedEvents(sentClientEventIds: string[]): void {
  if (typeof localStorage === "undefined") return;
  if (!sentClientEventIds.length) return;
  const set = new Set(sentClientEventIds);
  const remaining = loadQueuedEvents().filter((e) => !e.clientEventId || !set.has(e.clientEventId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}
