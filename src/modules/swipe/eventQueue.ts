import type { SendMediaSwipeEventInput } from "./mediaSwipeApi";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "@/lib/storage";

const STORAGE_KEY = "movi_swipe_event_queue_v1";

function uuidv4Fallback(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUuidLike(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

function nextClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return uuidv4Fallback();
}

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

function computeDedupeKey(
  recRequestId: unknown,
  position: unknown,
  mediaItemId: unknown,
): string | null {
  const rr = String(recRequestId ?? "").trim();
  const mi = String(mediaItemId ?? "").trim();
  const p = Number(position);
  if (!rr || !mi || !Number.isFinite(p) || p < 0) return null;
  return `${rr}:${Math.trunc(p)}:${mi}`;
}

function normalizeQueue(input: unknown): QueuedEvent[] {
  if (!Array.isArray(input)) return [];
  const out: QueuedEvent[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const any = raw as any;

    // Support legacy/batch storage shape: { ...base, events: [...] }
    if (Array.isArray(any.events)) {
      const baseQueuedAt = typeof any.queuedAt === "number" ? any.queuedAt : Date.now();
      const { events, ...base } = any;
      for (const e of events) {
        if (!e || typeof e !== "object") continue;
        out.push({ ...base, ...(e as any), queuedAt: baseQueuedAt });
      }
      continue;
    }

    out.push(any as QueuedEvent);
  }

  // Sanitize: ensure served dedupeKey when possible; otherwise strip deck context so the server doesn't reject.
  for (const ev of out) {
    // Ensure stable clientEventId so we can delete from queue after partial success.
    if (!isUuidLike((ev as any).clientEventId)) {
      (ev as any).clientEventId = nextClientEventId();
    }

    const rawKey = String((ev as any).dedupeKey ?? (ev as any).dedupe_key ?? "").trim();
    const computed =
      rawKey ||
      computeDedupeKey((ev as any).recRequestId, (ev as any).position, (ev as any).mediaItemId);

    if (computed) {
      (ev as any).dedupeKey = computed;
      (ev as any).dedupe_key = computed;
      continue;
    }

    const hasDeckContext =
      (ev as any).deckId != null ||
      (ev as any).recRequestId != null ||
      (ev as any).position != null;

    if (hasDeckContext) {
      // Can't build a served key => downgrade to a non-deck event to prevent poison retries.
      (ev as any).deckId = null;
      (ev as any).recRequestId = null;
      (ev as any).position = null;
      (ev as any).dedupeKey = null;
      (ev as any).dedupe_key = null;
    }
  }

  // cap growth (keep newest)
  return out.slice(-200);
}

export function loadQueuedEvents(): QueuedEvent[] {
  const raw = safeLocalStorageGetItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  const normalized = normalizeQueue(parsed);

  // If normalization changed shape/count, persist it to avoid repeated work.
  try {
    if (
      normalized.length !== parsed.length ||
      JSON.stringify(normalized) !== JSON.stringify(parsed)
    ) {
      safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // ignore
  }

  return normalized;
}

export function enqueueSwipeEvent(ev: SendMediaSwipeEventInput): void {
  const queue = loadQueuedEvents();
  const anyEv: any = ev as any;
  if (!isUuidLike(anyEv.clientEventId)) anyEv.clientEventId = nextClientEventId();
  queue.push({ ...(anyEv as any), queuedAt: Date.now() });

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
