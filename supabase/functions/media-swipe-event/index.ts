import { serve } from "jsr:@std/http@0.224.0/server";
import { corsHeadersFor } from "../_shared/http.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";
import { requireApiKeyHeader, requireUserFromRequest } from "../_shared/auth.ts";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { getDefaultSettingsForScope } from "../_shared/appSettingsSchema.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

// NOTE: This edge function supports BOTH:
// 1) single-event payload (legacy)
// 2) batch payload: { sessionId, deckId, position, mediaItemId, source, events: [...] }
// 3) multi payload: { items: [ { sessionId, deckId, position, mediaItemId, source, events:[...] }, ... ] }


const corsHeaders = (req: Request) => corsHeadersFor(req);

type Json = Record<string, unknown> | null;

type BatchEvent = {
  eventType: string;
  dwellMs?: number | null;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
  payload?: Json;
  clientEventId?: string | null;
};

type BaseBody = {
  sessionId: string;
  mediaItemId: string;
  deckId?: string | null;
  recRequestId?: string | null;
  position?: number | null;
  // Optional stable served key from media-swipe-deck (recRequestId:position:mediaItemId)
  dedupeKey?: string | null;
  dedupe_key?: string | null;
  source?: string | null;
  // legacy fields
  eventType?: string;
  dwellMs?: number | null;
  rating0_10?: number | null;
  inWatchlist?: boolean | null;
  payload?: Json;
  clientEventId?: string | null;
  // new
  events?: BatchEvent[];
};

const VALID_EVENT_TYPES = new Set([
  "impression",
  "detail_open",
  "detail_close",
  "dwell",
  "like",
  "dislike",
  "skip",
  "watchlist",
  "watchlist_add",
  "watchlist_remove",
  "rating",
  "rating_set",
  "share",
]);



function isUuidLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseServedDedupeKey(dk: unknown): { recRequestId: string; position: number; mediaItemId: string } | null {
  if (typeof dk !== "string") return null;
  const parts = dk.split(":");
  if (parts.length !== 3) return null;
  const [rid, posStr, mid] = parts;
  if (!isUuidLike(rid) || !isUuidLike(mid)) return null;
  const pos = Number(posStr);
  if (!Number.isFinite(pos) || !Number.isInteger(pos) || pos < 0 || pos > 5000) return null;
  return { recRequestId: rid, position: pos, mediaItemId: mid };
}

function buildServedDedupeKeyString(args: {
  provided?: unknown;
  recRequestId?: unknown;
  position?: unknown;
  mediaItemId?: unknown;
}): string | null {
  const mid = String(args.mediaItemId ?? "").trim();
  const parsed = parseServedDedupeKey(args.provided);
  if (parsed && (!mid || parsed.mediaItemId === mid)) {
    return `${parsed.recRequestId}:${parsed.position}:${parsed.mediaItemId}`;
  }

  const rid = String(args.recRequestId ?? "").trim();
  const pos = Number(args.position);
  if (!mid || !rid) return null;
  if (!isUuidLike(rid) || !isUuidLike(mid)) return null;
  if (!Number.isFinite(pos) || !Number.isInteger(pos) || pos < 0 || pos > 5000) return null;
  return `${rid}:${pos}:${mid}`;
}

function clampNumber(n: unknown, min: number, max: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : Number(n ?? NaN);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}
function isHalfStep0To10(n: unknown): n is number {
  if (typeof n !== "number" || !Number.isFinite(n)) return false;
  if (n < 0 || n > 10) return false;
  // allow increments of 0.5
  return Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
}

function sanitizePayload(payload: unknown): Json {
  if (payload == null) return null;
  if (typeof payload !== "object" || Array.isArray(payload)) return null;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (v === undefined) continue;
    if (typeof v === "function") continue;

    // Avoid large payloads. Keep primitives and shallow objects/arrays.
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.slice(0, 50);
      continue;
    }
    if (typeof v === "object") {
      // shallow copy only
      const shallow: Record<string, unknown> = {};
      for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) {
        if (
          vv === null ||
          typeof vv === "string" ||
          typeof vv === "number" ||
          typeof vv === "boolean"
        ) {
          shallow[kk] = vv;
        }
      }
      out[k] = shallow;
      continue;
    }
  }

  return Object.keys(out).length ? out : null;
}

async function hashPayload(payload: Json): Promise<string> {
  if (!payload) return "0";
  const enc = new TextEncoder();
  const data = enc.encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const arr = Array.from(new Uint8Array(digest));
  // 12 bytes is enough for dedupe-key entropy
  return arr.slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildDedupeKey(args: {
  sessionId: string;
  mediaItemId: string;
  eventType: string;
  deckId?: string | null;
  recRequestId?: string | null;
  position?: number | null;
  // Optional stable served key from media-swipe-deck (recRequestId:position:mediaItemId)
  dedupeKey?: string | null;
  dedupe_key?: string | null;
  inWatchlist?: boolean | null;
  rating0_10?: number | null;
  dwellMs?: number | null;
  payload: Json;
}): Promise<string> {
  const parts: string[] = [
    "v2",
    args.sessionId,
    args.mediaItemId,
    args.eventType,
    args.deckId ?? "-",
    String(args.position ?? "-"),
  ];

  if (args.inWatchlist !== null && args.inWatchlist !== undefined) {
    parts.push(`wl:${args.inWatchlist ? 1 : 0}`);
  }
  if (args.rating0_10 !== null && args.rating0_10 !== undefined) {
    parts.push(`r:${args.rating0_10}`);
  }
  if (args.dwellMs !== null && args.dwellMs !== undefined) {
    parts.push(`d:${args.dwellMs}`);
  }

  const pHash = await hashPayload(args.payload);
  parts.push(`p:${pHash}`);

  // cap length
  const key = parts.join("|");
  return key.length > 256 ? key.slice(0, 256) : key;
}

function getAction(payload: Json): string | null {
  const action = payload && typeof payload === "object" ? (payload as any).action : null;
  return typeof action === "string" && action.trim() ? action.trim() : null;
}

function mapOutcomeType(eventType: string, payload: Json): string {
  const action = getAction(payload);
  if (eventType === "like" && action === "more_like_this") return "more_like_this";
  if (eventType === "dislike" && action === "not_interested") return "not_interested";
  if (eventType === "dislike" && action === "hide") return "hide";
  return eventType;
}

function labelForEvent(
  eventType: string,
  payload: Json,
  rating0_10?: number | null,
  inWatchlist?: boolean | null,
): string | null {
  if (eventType === "like") {
    const action = getAction(payload);
    if (action === "status") return "status_watched";
    if (action === "more_like_this") return "swipe_more_like_this";
    return "swipe_like";
  }
  if (eventType === "dislike") {
    const action = getAction(payload);
    if (action === "not_interested") return "swipe_not_interested";
    if (action === "hide") return "swipe_hide";
    return "swipe_dislike";
  }
  if (eventType === "skip") return "swipe_skip";
  if (eventType === "watchlist" || eventType === "watchlist_add" || eventType === "watchlist_remove") {
    const wl = eventType === "watchlist_add" ? true : eventType === "watchlist_remove" ? false : !!inWatchlist;
    return wl ? "watchlist_add" : "watchlist_remove";
  }
  if (eventType === "rating" || eventType === "rating_set") {
    if (typeof rating0_10 === "number") {
      if (rating0_10 >= 8) return "rating_positive";
      if (rating0_10 <= 4) return "rating_negative";
      return "rating_set";
    }
    return "rating_set";
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const requestId = (() => {
    const h = req.headers.get("x-request-id");
    if (h && h.trim()) return h.trim();
    try {
      return crypto.randomUUID();
    } catch {
      return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    }
  })();

  const json = (
    body: any,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...extraHeaders,
      },
    });

  type Issue = {
    level: "warn" | "error";
    code: string;
    message: string;
    clientEventId?: string;
    meta?: Record<string, unknown>;
  };

  const issues: Issue[] = [];
  const pushIssue = (i: Issue) => {
    if (issues.length >= 200) return;
    issues.push(i);
  };

  const accepted = new Set<string>();
  const rejected = new Set<string>();
  const retry = new Set<string>();

  const ensureClientEventId = (raw: unknown): { id: string; replacedFrom?: string } => {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s && isUuidLike(s)) return { id: s };
    const generated = crypto.randomUUID();
    return { id: generated, replacedFrom: s || undefined };
  };

  const markRejected = (clientEventId: string, code: string, message: string, meta?: Record<string, unknown>) => {
    rejected.add(clientEventId);
    pushIssue({ level: "error", code, message, clientEventId, meta });
  };

  const markRetry = (clientEventId: string, code: string, message: string, meta?: Record<string, unknown>) => {
    retry.add(clientEventId);
    pushIssue({ level: "warn", code, message, clientEventId, meta });
  };

  const markWarn = (clientEventId: string, code: string, message: string, meta?: Record<string, unknown>) => {
    pushIssue({ level: "warn", code, message, clientEventId, meta });
  };

  const isDeterministicDbError = (code: unknown): boolean => {
    const c = typeof code === "string" ? code : "";
    if (!c) return false;
    // 22***: data exception (e.g. invalid uuid), 23***: integrity constraint violation
    if (c.startsWith("22") || c.startsWith("23")) return true;
    // 42***: syntax/undefined column/table etc. Deterministic for a given deploy.
    if (c.startsWith("42")) return true;
    // PostgREST custom codes are deterministic.
    if (c.startsWith("PGRST")) return true;
    return false;
  };

  try {
    const apiKeyError = requireApiKeyHeader(req, { allowBearer: true });
    if (apiKeyError) return apiKeyError;

    const supabase = getUserClient(req);

    const auth = await requireUserFromRequest(req, supabase, { mode: "user" });
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.data!.userId;

    // Service-role client (best-effort) for reading server-only app settings.
    let svc: any = null;
    try {
      svc = getAdminClient(req);
    } catch {
      svc = null;
    }

    let serverOnly: Record<string, unknown> = getDefaultSettingsForScope("server_only");
    if (svc) {
      try {
        const env = await loadAppSettingsForScopes(svc as any, ["server_only"], { cacheTtlMs: 60_000 });
        serverOnly = { ...serverOnly, ...((env.settings ?? {}) as any) } as any;
      } catch {
        // ignore
      }
    }

    // Rate limit (admin-tunable via ops.rate_limits.actions.swipe_event)
    const rateLimits = ((serverOnly as any)["ops.rate_limits"] as any)?.actions ?? {};
    const maxEventsPerMin = clampNumber((rateLimits as any).swipe_event ?? 1000, 1, 6000);
    const rl = await enforceRateLimit(req, { action: "swipe_event", maxPerMinute: maxEventsPerMin });
    if (!rl.ok) {
      return json(
        {
          ok: true,
          requestId,
          acceptedClientEventIds: [],
          rejectedClientEventIds: [],
          retryClientEventIds: [],
          shouldRetry: true,
          retryAfterSeconds: rl.retryAfterSeconds ?? 5,
          issues: [
            {
              level: "warn",
              code: "RATE_LIMIT",
              message: "Rate limit exceeded. Retry later.",
              meta: { retryAfterSeconds: rl.retryAfterSeconds ?? 5 },
            },
          ],
        },
        200,
        rl.retryAfterSeconds ? { "retry-after": String(rl.retryAfterSeconds) } : {},
      );
    }

    // Recsys knobs (admin-tunable)
    const syntheticWatchedDwellMs = clampNumber(
      (serverOnly as any)["ranking.swipe.status_watched.synthetic_dwell_ms"] ?? 12000,
      0,
      600_000,
    );
    const centroidRefreshSampleRate = clampNumber(
      (serverOnly as any)["ranking.swipe.centroids.refresh_sample_rate"] ?? 0.25,
      0,
      1,
    );
    const centroidK = clampNumber((serverOnly as any)["ranking.swipe.centroids.k"] ?? 3, 1, 10);
    const centroidMaxItems = clampNumber(
      (serverOnly as any)["ranking.swipe.centroids.max_items"] ?? 60,
      10,
      200,
    );

    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return json({
        ok: true,
        requestId,
        acceptedClientEventIds: [],
        rejectedClientEventIds: [],
        retryClientEventIds: [],
        shouldRetry: false,
        issues: [
          {
            level: "error",
            code: "BAD_JSON",
            message: "Request body is not valid JSON.",
          },
        ],
      });
    }

    const items: BaseBody[] = Array.isArray(raw?.items) ? (raw.items as BaseBody[]) : [raw as BaseBody];

    const rows: any[] = [];
    const rowClientEventIds: string[] = [];

    // "status" operations (watched / want_to_watch / etc.) are handled separately from media_events
    // so they don't corrupt likes/dislikes or media_feedback.last_action.
    const statusOps: Array<{
      mediaItemId: string;
      status: "want_to_watch" | "watching" | "watched" | "dropped";
      enabled: boolean;
      occurredAtIso: string;
    }> = [];

    const watchlistOps: Array<{ mediaItemId: string; enabled: boolean; occurredAtIso: string }> = [];
    const ratingOps: Array<{ mediaItemId: string; rating0_10: number | null; occurredAtIso: string }> = [];

    const ltrLabelsByKey = new Map<
      string,
      { recRequestId: string; mediaItemId: string; position: number; labels: Set<string> }
    >();
    let hasStrongPositive = false;

    // Track accepted rows for background tasks when we fall back to per-row upserts.
    const acceptedRowsForBg: any[] = [];

    for (const body of items) {
      if (!body || typeof body !== "object") continue;

      const incomingEvents: BatchEvent[] =
        Array.isArray((body as any).events) && (body as any).events.length
          ? ((body as any).events as BatchEvent[])
          : [
              {
                eventType: (body as any).eventType ?? "",
                dwellMs: (body as any).dwellMs ?? null,
                rating0_10: (body as any).rating0_10 ?? null,
                inWatchlist: (body as any).inWatchlist ?? null,
                payload: (body as any).payload ?? null,
                clientEventId: (body as any).clientEventId ?? null,
              },
            ];

      const baseSessionId = String((body as any).sessionId ?? "").trim();
      const baseMediaItemId = String((body as any).mediaItemId ?? "").trim();

      // If base ids are invalid, reject all events in this item.
      if (!baseSessionId || !baseMediaItemId || !isUuidLike(baseSessionId) || !isUuidLike(baseMediaItemId)) {
        for (const ev of incomingEvents) {
          const { id: clientEventId } = ensureClientEventId((ev as any)?.clientEventId ?? (body as any)?.clientEventId);
          markRejected(
            clientEventId,
            "BAD_INPUT",
            "Invalid or missing sessionId/mediaItemId.",
            { sessionId: baseSessionId, mediaItemId: baseMediaItemId },
          );
        }
        continue;
      }

      const sid = baseSessionId;
      const mid = baseMediaItemId;

      const deckIdRaw = (body as any).deckId ?? null;
      const recRequestIdRaw = (body as any).recRequestId ?? (body as any).rec_request_id ?? null;
      const positionRaw = (body as any).position ?? null;
      const servedDedupeKeyRaw = (body as any).dedupeKey ?? (body as any).dedupe_key ?? null;

      const source = (body as any).source ?? null;

      const deckIdNorm =
        deckIdRaw != null && String(deckIdRaw).trim() ? String(deckIdRaw).trim() : null;
      const recRequestIdNorm =
        recRequestIdRaw != null && String(recRequestIdRaw).trim() ? String(recRequestIdRaw).trim() : null;
      const positionNorm =
        positionRaw != null && positionRaw !== undefined
          ? (typeof positionRaw === "number" ? positionRaw : Number(positionRaw))
          : null;

      // Validate deck context fields; if invalid, drop them (do NOT reject the whole event).
      const deckIdOk = !deckIdNorm || isUuidLike(deckIdNorm);
      const recRequestOk = !recRequestIdNorm || isUuidLike(recRequestIdNorm);
      const posOk =
        positionNorm === null ||
        (Number.isFinite(positionNorm) && Number.isInteger(positionNorm) && positionNorm >= 0 && positionNorm <= 5000);

      const baseHasDeckContext =
        deckIdNorm != null || recRequestIdNorm != null || positionNorm != null ||
        (typeof servedDedupeKeyRaw === "string" && String(servedDedupeKeyRaw).trim().length > 0);

      // Compute servedKey (used to join rec_impressions/media_rank_feature_items_v2)
      const servedKeyMaybe = buildServedDedupeKeyString({
        provided: servedDedupeKeyRaw,
        recRequestId: recRequestIdNorm,
        position: positionNorm,
        mediaItemId: mid,
      });

      for (const ev of incomingEvents) {
        const { id: clientEventId, replacedFrom } = ensureClientEventId(
          (ev as any)?.clientEventId ?? (body as any)?.clientEventId,
        );
        if (replacedFrom) {
          markWarn(clientEventId, "CLIENT_EVENT_ID_REPLACED", "clientEventId was missing/invalid and was replaced.", {
            replacedFrom,
          });
        }

        const eventType = String((ev as any)?.eventType ?? "");
        if (!VALID_EVENT_TYPES.has(eventType)) {
          markRejected(clientEventId, "BAD_INPUT", `Invalid eventType: ${eventType}`);
          continue;
        }

        const dwellMs = (ev as any).dwellMs ?? null;
        const rating0_10 = (ev as any).rating0_10 ?? null;
        const inWatchlist = (ev as any).inWatchlist ?? null;

        if (dwellMs !== null && (typeof dwellMs !== "number" || !Number.isFinite(dwellMs) || dwellMs < 0)) {
          markRejected(clientEventId, "BAD_INPUT", "Invalid dwellMs");
          continue;
        }

        if (rating0_10 !== null && !isHalfStep0To10(rating0_10)) {
          markRejected(clientEventId, "BAD_INPUT", "Invalid rating0_10");
          continue;
        }

        if (inWatchlist !== null && typeof inWatchlist !== "boolean") {
          markRejected(clientEventId, "BAD_INPUT", "Invalid inWatchlist");
          continue;
        }

        const payload = sanitizePayload((ev as any).payload ?? (body as any).payload ?? null);
        const occurredAtIso = new Date().toISOString();
        const eventDay = occurredAtIso.slice(0, 10);

        // Build safe deck context for THIS event.
        let deckIdSafe = deckIdOk ? deckIdNorm : null;
        let recRequestSafe = recRequestOk ? recRequestIdNorm : null;
        let posSafe: number | null = posOk ? (typeof positionNorm === "number" ? positionNorm : null) : null;
        let servedKeySafe: string | null = servedKeyMaybe;

        if (baseHasDeckContext) {
          if (!deckIdOk || !recRequestOk || !posOk) {
            deckIdSafe = null;
            recRequestSafe = null;
            posSafe = null;
            servedKeySafe = null;
            markWarn(
              clientEventId,
              "DECK_CONTEXT_DROPPED",
              "Dropped invalid deck context fields to avoid poisoning the batch.",
              {
                deckId: deckIdNorm,
                recRequestId: recRequestIdNorm,
                position: positionNorm,
              },
            );
          } else if (!servedKeySafe) {
            // If the client attempted to attach deck identity but we can't compute a served key, drop deck context.
            deckIdSafe = null;
            recRequestSafe = null;
            posSafe = null;
            servedKeySafe = null;
            markWarn(
              clientEventId,
              "SERVED_KEY_MISSING",
              "Missing/invalid served identity. Event recorded without deck context.",
            );
          }
        }

        // Special case: diary/status updates are sent as eventType="like" with payload.action="status".
        // We treat these as *status* operations and do NOT record them in media_events.
        if (eventType === "like" && payload && typeof payload === "object" && (payload as any).action === "status") {
          const stRaw = typeof (payload as any).status === "string" ? String((payload as any).status) : "watched";
          const norm:
            | "want_to_watch"
            | "watching"
            | "watched"
            | "dropped" =
            stRaw === "want_to_watch" || stRaw === "watchlist" ? "want_to_watch"
              : stRaw === "watching" ? "watching"
                : stRaw === "dropped" ? "dropped"
                  : "watched";
          const enabled = typeof (payload as any).enabled === "boolean" ? Boolean((payload as any).enabled) : true;
          statusOps.push({ mediaItemId: mid, status: norm, enabled, occurredAtIso });
          accepted.add(clientEventId);

          // Diary "watched" should influence taste updates & feedback (synthetic dwell).
          if (enabled && norm === "watched") {
            hasStrongPositive = true;
            const syntheticDwellMs = syntheticWatchedDwellMs;
            const syntheticPayload = sanitizePayload({
              ...(payload ?? {}),
              _synthetic: "status_watched_to_dwell",
            });
            const synClientEventId = crypto.randomUUID();
            const synEventType = "dwell";
            const synDedupeKey = await buildDedupeKey({
              sessionId: sid,
              mediaItemId: mid,
              eventType: synEventType,
              deckId: null,
              recRequestId: null,
              position: null,
              inWatchlist: null,
              rating0_10: null,
              dwellMs: syntheticDwellMs,
              payload: syntheticPayload,
            });

            rows.push({
              user_id: userId,
              session_id: sid,
              deck_id: null,
              rec_request_id: null,
              position: null,
              media_item_id: mid,
              event_type: synEventType,
              source: source ?? "diary",
              dwell_ms: syntheticDwellMs,
              payload: syntheticPayload,
              client_event_id: synClientEventId,
              rating_0_10: null,
              in_watchlist: null,
              event_day: eventDay,
              dedupe_key: synDedupeKey,
              served_dedupe_key: null,
            });
            // NOTE: synthetic rows are internal-only and are not tied to clientEventId.
          }

          continue;
        }

        // Compute dedupe key for idempotency.
        const dedupeKey = await buildDedupeKey({
          sessionId: sid,
          mediaItemId: mid,
          eventType,
          deckId: deckIdSafe,
          recRequestId: recRequestSafe,
          position: posSafe,
          dedupeKey: null,
          dedupe_key: null,
          inWatchlist,
          rating0_10,
          dwellMs,
          payload,
        });

        rows.push({
          user_id: userId,
          session_id: sid,
          deck_id: deckIdSafe,
          rec_request_id: recRequestSafe,
          position: posSafe,
          media_item_id: mid,
          event_type: eventType,
          source,
          dwell_ms: dwellMs,
          payload,
          client_event_id: clientEventId,
          rating_0_10: rating0_10,
          in_watchlist: inWatchlist,
          event_day: eventDay,
          dedupe_key: dedupeKey,
          served_dedupe_key: servedKeySafe,
        });
        rowClientEventIds.push(clientEventId);

        const ltr = labelForEvent(eventType, payload, rating0_10, inWatchlist);
        if (ltr && servedKeySafe) {
          const parsed = parseServedDedupeKey(servedKeySafe);
          if (parsed && parsed.mediaItemId === mid) {
            const dk = `${parsed.recRequestId}:${parsed.position}:${parsed.mediaItemId}`;
            let entry = ltrLabelsByKey.get(dk);
            if (!entry) {
              entry = { recRequestId: parsed.recRequestId, mediaItemId: parsed.mediaItemId, position: parsed.position, labels: new Set<string>() };
              ltrLabelsByKey.set(dk, entry);
            }
            entry.labels.add(ltr);
          }
        }

        // Diary sync helpers for watchlist/rating.
        if (eventType === "watchlist") {
          watchlistOps.push({ mediaItemId: mid, enabled: Boolean(inWatchlist), occurredAtIso });
        } else if (eventType === "watchlist_add") {
          watchlistOps.push({ mediaItemId: mid, enabled: true, occurredAtIso });
        } else if (eventType === "watchlist_remove") {
          watchlistOps.push({ mediaItemId: mid, enabled: false, occurredAtIso });
        } else if (eventType === "rating" || eventType === "rating_set") {
          ratingOps.push({ mediaItemId: mid, rating0_10: typeof rating0_10 === "number" ? rating0_10 : null, occurredAtIso });
        }

        // Strong positive heuristics
        if (
          eventType === "like" ||
          (eventType === "watchlist" && inWatchlist === true) ||
          eventType === "watchlist_add" ||
          ((eventType === "rating" || eventType === "rating_set") && typeof rating0_10 === "number" && rating0_10 >= 8)
        ) {
          hasStrongPositive = true;
        }

        // Mark as accepted pending DB write.
        accepted.add(clientEventId);
      }
    }

    // Persist event rows (best-effort). If bulk upsert fails, fall back to per-row so one bad row doesn't poison the batch.
    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("media_events")
        .upsert(rows, { onConflict: "user_id,dedupe_key,event_day", ignoreDuplicates: true });

      if (upsertError) {
        // Bulk failed: retry per-row to salvage good rows.
        pushIssue({
          level: "warn",
          code: "BULK_UPSERT_FAILED",
          message: "Bulk upsert failed; retrying per-row.",
          meta: { message: upsertError.message, code: (upsertError as any).code },
        });

        // Reset: all row events become pending again.
        for (const id of rowClientEventIds) {
          accepted.delete(id);
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const ceid = rowClientEventIds[i];
          try {
            const { error } = await supabase
              .from("media_events")
              .upsert([row], { onConflict: "user_id,dedupe_key,event_day", ignoreDuplicates: true });
            if (!error) {
              accepted.add(ceid);
              acceptedRowsForBg.push(row);
              continue;
            }

            const code = (error as any)?.code;
            if (isDeterministicDbError(code)) {
              markRejected(ceid, "DB_REJECTED", "DB rejected this event (deterministic).");
            } else {
              markRetry(ceid, "DB_RETRY", "Temporary DB error; retry later.");
            }
          } catch (e) {
            markRetry(ceid, "DB_RETRY", "Temporary DB error; retry later.", { message: (e as any)?.message });
          }
        }
      } else {
        // Bulk succeeded: all rows are accepted for background tasks.
        acceptedRowsForBg.push(...rows);
      }
    }

    // Remove any overlaps (accepted beats retry/reject).
    for (const id of accepted) {
      rejected.delete(id);
      retry.delete(id);
    }
    for (const id of rejected) {
      retry.delete(id);
    }

    // Background tasks (taste vectors, centroid refresh, LTR labels, diary sync).
    // We return immediately after recording events to keep the UI snappy.
    const runBackgroundTasks = async () => {
      // Helper: derive content_type from media_items.kind
      const kindToContentType = (kind: unknown): string => {
        const k = typeof kind === "string" ? kind : "";
        if (k === "series") return "series";
        if (k === "anime") return "anime";
        if (k === "episode") return "series";
        return "movie";
      };

      const contentTypeCache = new Map<string, string>();
      const getContentType = async (titleId: string): Promise<string> => {
        const cached = contentTypeCache.get(titleId);
        if (cached) return cached;
        const { data: mi } = await supabase.from("media_items").select("kind").eq("id", titleId).maybeSingle();
        const ct = kindToContentType((mi as any)?.kind);
        contentTypeCache.set(titleId, ct);
        return ct;
      };

      // Bulk prefetch kinds for this request to avoid N queries when syncing diary operations.
      try {
        const ids = new Set<string>();
        for (const op of statusOps) ids.add(op.mediaItemId);
        for (const op of watchlistOps) ids.add(op.mediaItemId);
        for (const op of ratingOps) ids.add(op.mediaItemId);

        const idList = Array.from(ids);
        if (idList.length) {
          const { data: items2 } = await supabase.from("media_items").select("id,kind").in("id", idList);
          for (const it of (items2 ?? []) as any[]) {
            if (it?.id) contentTypeCache.set(String(it.id), kindToContentType(it.kind));
          }
        }
      } catch {
        // ignore
      }

      // 1) Apply diary status ops (watched toggleable)
      for (const op of statusOps) {
        try {
          const contentType = await getContentType(op.mediaItemId);

          if (!op.enabled) {
            await supabase
              .from("library_entries")
              .delete()
              .eq("user_id", userId)
              .eq("title_id", op.mediaItemId)
              .eq("status", op.status);
            continue;
          }

          const base: any = {
            user_id: userId,
            title_id: op.mediaItemId,
            content_type: contentType,
            status: op.status,
            updated_at: op.occurredAtIso,
          };
          if (op.status === "watched") base.completed_at = op.occurredAtIso;
          if (op.status === "watching") base.started_at = op.occurredAtIso;

          await supabase.from("library_entries").upsert(base, { onConflict: "user_id,title_id" });
        } catch {
          // ignore
        }
      }

      // 2) Sync watchlist ops into diary library (want_to_watch)
      for (const op of watchlistOps) {
        try {
          const contentType = await getContentType(op.mediaItemId);
          if (op.enabled) {
            await supabase
              .from("library_entries")
              .upsert(
                {
                  user_id: userId,
                  title_id: op.mediaItemId,
                  content_type: contentType,
                  status: "want_to_watch",
                  updated_at: op.occurredAtIso,
                },
                { onConflict: "user_id,title_id" },
              );
          } else {
            await supabase
              .from("library_entries")
              .delete()
              .eq("user_id", userId)
              .eq("title_id", op.mediaItemId)
              .eq("status", "want_to_watch");
          }
        } catch {
          // ignore
        }
      }

      // 3) Sync rating ops into ratings table
      for (const op of ratingOps) {
        try {
          const contentType = await getContentType(op.mediaItemId);
          if (op.rating0_10 === null) {
            await supabase.from("ratings").delete().eq("user_id", userId).eq("title_id", op.mediaItemId);
          } else {
            await supabase
              .from("ratings")
              .upsert(
                {
                  user_id: userId,
                  title_id: op.mediaItemId,
                  content_type: contentType,
                  rating: op.rating0_10,
                  updated_at: op.occurredAtIso,
                },
                { onConflict: "user_id,title_id" },
              );
          }
        } catch {
          // ignore
        }
      }

      // 4) Taste vectors update (best-effort)
      const tastePromises: Promise<unknown>[] = [];
      for (const r of acceptedRowsForBg) {
        const et = r.event_type as string;
        if (![
          "like",
          "dislike",
          "skip",
          "watchlist",
          "watchlist_add",
          "watchlist_remove",
          "rating",
          "rating_set",
          "dwell",
          "detail_open",
        ].includes(et)) {
          continue;
        }

        tastePromises.push(
          (async () => {
            try {
              await supabase.rpc("media_update_taste_vectors_v1", {
                p_session_id: r.session_id,
                p_media_item_id: r.media_item_id,
                p_event_type: et,
                p_dwell_ms: r.dwell_ms,
                p_rating_0_10: r.rating_0_10,
                p_is_strong_signal: Boolean(r.in_watchlist),
              });
            } catch {
              // best-effort
            }
          })(),
        );
      }

      await Promise.all(tastePromises);

      // Occasional centroid refresh (best-effort)
      if (hasStrongPositive) {
        const shouldRefresh = Math.random() < centroidRefreshSampleRate;
        if (shouldRefresh) {
          try {
            await supabase.rpc("media_refresh_user_centroids_v1", {
              p_user_id: userId,
              p_k: centroidK,
              p_max_items: centroidMaxItems,
            });
          } catch {
            // best-effort
          }
        }
      }

      // LTR training labels (best-effort)
      if (ltrLabelsByKey.size) {
        const logClient = svc ?? supabase;
        for (const [dedupeKey, entry] of ltrLabelsByKey.entries()) {
          const labels = entry?.labels;
          if (!dedupeKey || !labels || !labels.size) continue;

          try {
            const { data: existing } = await logClient
              .from("media_rank_feature_items_v2")
              .select("id, labels")
              .eq("user_id", userId)
              .eq("dedupe_key", dedupeKey)
              .maybeSingle();

            const oldArr = Array.isArray((existing as any)?.labels)
              ? (existing as any).labels.map((x: any) => String(x)).filter(Boolean)
              : [];
            const merged = new Set(oldArr);
            for (const l of Array.from(labels)) merged.add(String(l));
            const mergedArr = Array.from(merged);

            if ((existing as any)?.id) {
              await logClient
                .from("media_rank_feature_items_v2")
                .update({ labels: mergedArr })
                .eq("id", (existing as any).id);
            } else {
              await logClient.from("media_rank_feature_items_v2").insert([
                {
                  user_id: userId,
                  dedupe_key: dedupeKey,
                  rec_request_id: entry.recRequestId,
                  media_item_id: entry.mediaItemId,
                  position: entry.position,
                  labels: mergedArr,
                  features: {},
                },
              ]);
            }
          } catch {
            // ignore
          }
        }
      }
    };

    const needsBg = (() => {
      if (statusOps.length || watchlistOps.length || ratingOps.length) return true;
      if (ltrLabelsByKey.size) return true;
      const hasTasteRelevant = acceptedRowsForBg.some((r) => {
        const et = String((r as any)?.event_type ?? "");
        return [
          "like",
          "dislike",
          "skip",
          "watchlist",
          "watchlist_add",
          "watchlist_remove",
          "rating",
          "rating_set",
          "dwell",
          "detail_open",
        ].includes(et);
      });
      return hasTasteRelevant || hasStrongPositive;
    })();

    const bg = needsBg ? runBackgroundTasks().catch(() => null) : Promise.resolve(null);
    const er = (globalThis as any).EdgeRuntime;
    if (er && typeof er.waitUntil === "function") {
      er.waitUntil(bg);
    }



    // --- Ingest rollups (hourly) ---
    // We log aggregated issue counts + accepted/rejected/retry to a rollup table.
    // This is sampled (default 10%) to avoid excessive write volume at scale.
    const rollupSampleRate = clampNumber((serverOnly as any)["ops.swipe_ingest_rollups.sample_rate"] ?? 0.1, 0, 1);
    const shouldLogRollup = !!svc && rollupSampleRate > 0 && Math.random() < rollupSampleRate;
    if (shouldLogRollup) {
      try {
        const bucket = new Date();
        bucket.setUTCMinutes(0, 0, 0);
        const issueCounts: Record<string, number> = {};
        for (const it of issues) {
          const c = String((it as any)?.code ?? "").trim();
          if (!c) continue;
          issueCounts[c] = (issueCounts[c] ?? 0) + 1;
        }
        await (svc as any).rpc("swipe_ingest_rollup_add_v1", {
          p_bucket_start: bucket.toISOString(),
          p_requests: 1,
          p_accepted: accepted.size,
          p_rejected: rejected.size,
          p_retry: retry.size,
          p_issue_counts: issueCounts,
          p_sample_rate: rollupSampleRate,
        });
      } catch {
        // best-effort; never fail the user request because metrics logging failed
      }
    }
    return json({
      ok: true,
      requestId,
      acceptedClientEventIds: Array.from(accepted),
      rejectedClientEventIds: Array.from(rejected),
      retryClientEventIds: Array.from(retry),
      shouldRetry: retry.size > 0,
      sent: accepted.size,
      attempted: accepted.size + rejected.size + retry.size,
      items: items.length,
      issues,
    });
  } catch (e) {
    pushIssue({
      level: "error",
      code: "UNEXPECTED",
      message: (e as Error)?.message ?? "Unknown",
    });

    return json({
      ok: true,
      requestId,
      acceptedClientEventIds: Array.from(accepted),
      rejectedClientEventIds: Array.from(rejected),
      retryClientEventIds: Array.from(retry),
      shouldRetry: true,
      issues,
    });
  }
});
