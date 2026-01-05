import type { SendMediaSwipeEventInput } from "./mediaSwipeApi";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "@/lib/storage";

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
  return safeParse(safeLocalStorageGetItem(STORAGE_KEY));
}

export function enqueueSwipeEvent(ev: SendMediaSwipeEventInput): void {
  const queue = loadQueuedEvents();
  queue.push({ ...ev, queuedAt: Date.now() });

  // cap growth
  const capped = queue.slice(-200);
  safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(capped));
}

export function removeQueuedEvents(sentClientEventIds: string[]): void {
  if (!sentClientEventIds.length) return;
  const set = new Set(sentClientEventIds);
  const remaining = loadQueuedEvents().filter((e) => !e.clientEventId || !set.has(e.clientEventId));
  safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(remaining));
}
