import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersFor } from "../_shared/http.ts";
import { getUserIdFromRequest } from "../_shared/jwt.ts";

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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")!,
        },
      },
    });


const userId = getUserIdFromRequest(req);

let raw: any;
try {
  raw = await req.json();
} catch {
  return new Response(JSON.stringify({ ok: false, code: "BAD_JSON" }), {
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    status: 400,
  });
}

const items: BaseBody[] = Array.isArray(raw?.items) ? (raw.items as BaseBody[]) : [raw as BaseBody];

const rows: any[] = [];
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
const ltrLabels: string[] = [];
let hasStrongPositive = false;

for (const body of items) {
  const sessionId = body.sessionId;
  const mediaItemId = body.mediaItemId;
  const deckId = body.deckId ?? null;
  const recRequestId = body.recRequestId ?? null;
  const position = body.position ?? null;
  const source = body.source ?? null;

  if (!sessionId || !mediaItemId) {
    return new Response(JSON.stringify({ ok: false, code: "BAD_INPUT", message: "Missing sessionId/mediaItemId" }), {
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      status: 400,
    });
  }

  const incomingEvents: BatchEvent[] =
    Array.isArray(body.events) && body.events.length
      ? body.events
      : [
          {
            eventType: body.eventType ?? "",
            dwellMs: body.dwellMs ?? null,
            rating0_10: body.rating0_10 ?? null,
            inWatchlist: body.inWatchlist ?? null,
            payload: body.payload ?? null,
            clientEventId: body.clientEventId ?? null,
          },
        ];

      // Validate & normalize

      for (const ev of incomingEvents) {
      const eventType = String(ev.eventType ?? "");
      if (!VALID_EVENT_TYPES.has(eventType)) {
        return new Response(
          JSON.stringify({ ok: false, code: "BAD_INPUT", message: `Invalid eventType: ${eventType}` }),
          { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 400 },
        );
      }

      const dwellMs = ev.dwellMs ?? null;
      const rating0_10 = ev.rating0_10 ?? null;
      const inWatchlist = ev.inWatchlist ?? null;

      if (dwellMs !== null && (typeof dwellMs !== "number" || !Number.isFinite(dwellMs) || dwellMs < 0)) {
        return new Response(JSON.stringify({ ok: false, code: "BAD_INPUT", message: "Invalid dwellMs" }), {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (rating0_10 !== null && !isHalfStep0To10(rating0_10)) {
        return new Response(JSON.stringify({ ok: false, code: "BAD_INPUT", message: "Invalid rating0_10" }), {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (inWatchlist !== null && typeof inWatchlist !== "boolean") {
        return new Response(JSON.stringify({ ok: false, code: "BAD_INPUT", message: "Invalid inWatchlist" }), {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
          status: 400,
        });
      }

      const payload = sanitizePayload(ev.payload ?? body.payload ?? null);
      const occurredAtIso = new Date().toISOString();

      // Special case: diary/status updates are sent as eventType="like" with payload.action="status".
      // We treat these as *status* operations and do NOT record them in media_events, so likes remain separate.
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
        statusOps.push({ mediaItemId, status: norm, enabled, occurredAtIso });
        if (enabled && norm === "watched") hasStrongPositive = true;
        continue;
      }
      const clientEventId = ev.clientEventId ?? crypto.randomUUID();
      const dedupeKey = await buildDedupeKey({
        sessionId,
        mediaItemId,
        eventType,
        deckId,
        position,
        inWatchlist,
        rating0_10,
        dwellMs,
        payload,
      });

      rows.push({
        user_id: userId,
        session_id: sessionId,
        deck_id: deckId,
        rec_request_id: recRequestId,
        position,
        media_item_id: mediaItemId,
        event_type: eventType,
        source,
        dwell_ms: dwellMs,
        payload,
        client_event_id: clientEventId,
        rating_0_10: rating0_10,
        in_watchlist: inWatchlist,
        dedupe_key: dedupeKey,
      });

      const ltr = labelForEvent(eventType, payload, rating0_10, inWatchlist);
      if (ltr) ltrLabels.push(ltr);

      // Diary sync helpers for watchlist/rating.
      if (eventType === "watchlist") {
        watchlistOps.push({ mediaItemId, enabled: Boolean(inWatchlist), occurredAtIso });
      } else if (eventType === "watchlist_add") {
        watchlistOps.push({ mediaItemId, enabled: true, occurredAtIso });
      } else if (eventType === "watchlist_remove") {
        watchlistOps.push({ mediaItemId, enabled: false, occurredAtIso });
      } else if (eventType === "rating" || eventType === "rating_set") {
        ratingOps.push({ mediaItemId, rating0_10: typeof rating0_10 === "number" ? rating0_10 : null, occurredAtIso });
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
    }
  }

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("media_events")
        .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

      if (upsertError) {
        return new Response(
          JSON.stringify({ ok: false, code: "UPSERT_FAILED", message: upsertError.message }),
          { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 500 },
        );
      }
    }


    // Best-effort: also record outcomes in a compact table for offline evaluation.
    // This is intentionally redundant with media_events to keep training/eval joins cheap and stable.
    try {
      if (rows.length) {
        const outcomeRows = rows.map((r: any) => ({
          rec_request_id: r.rec_request_id ?? null,
          user_id: r.user_id,
          session_id: r.session_id,
          deck_id: r.deck_id ?? null,
          position: r.position ?? null,
          media_item_id: r.media_item_id,
          outcome_type: mapOutcomeType(String(r.event_type ?? ""), (r.payload ?? null) as any),
          source: r.source ?? null,
          dwell_ms: r.dwell_ms ?? null,
          rating_0_10: r.rating_0_10 ?? null,
          in_watchlist: r.in_watchlist ?? null,
          client_event_id: r.client_event_id ?? null,
          dedupe_key: r.dedupe_key,
          payload: r.payload ?? null,
        }));
        const { error: outErr } = await supabase
          .from("rec_outcomes")
          .upsert(outcomeRows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true, returning: "minimal" });
        void outErr;
      }
    } catch {
      // ignore
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
      const { data: items } = await supabase.from("media_items").select("id,kind").in("id", idList);
      for (const it of (items ?? []) as any[]) {
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
        // Delete only if the row matches the status we're clearing (so we don't blow away other states).
        await supabase
          .from("library_entries")
          .delete()
          .eq("user_id", userId)
          .eq("title_id", op.mediaItemId)
          .eq("status", op.status);
        continue;
      }

      // Enable / set status
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
  for (const r of rows) {
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
    ].includes(et)) {
      continue;
    }

    tastePromises.push(
      supabase
        .rpc("media_update_taste_vectors_v1", {
          p_session_id: r.session_id,
          p_media_item_id: r.media_item_id,
          p_event_type: et,
          p_dwell_ms: r.dwell_ms,
          p_rating_0_10: r.rating_0_10,
          p_in_watchlist: r.in_watchlist,
        })
        .then(() => null)
        .catch(() => null),
    );
  }

  // Status ops don't write media_events, but we still treat *enabled* watched as a mild positive signal.
  for (const op of statusOps) {
    if (!op.enabled) continue;
    tastePromises.push(
      supabase
        .rpc("media_update_taste_vectors_v1", {
          p_session_id: sessionId,
          p_media_item_id: op.mediaItemId,
          p_event_type: "like",
          p_dwell_ms: null,
          p_rating_0_10: null,
          p_in_watchlist: null,
        })
        .then(() => null)
        .catch(() => null),
    );
  }

  await Promise.all(tastePromises);

  // Occasional centroid refresh (best-effort)
  if (hasStrongPositive) {
    const shouldRefresh = Math.random() < 0.25;
    if (shouldRefresh) {
      await supabase.rpc("media_refresh_user_centroids_v1", { p_user_id: userId }).catch(() => null);
    }
  }

  // LTR training labels for the current deck (best-effort)
  if (deckId && ltrLabels.length) {
    try {
      const { data: existing } = await supabase
        .from("media_rank_feature_log")
        .select("id, label")
        .eq("deck_id", deckId)
        .eq("media_item_id", mediaItemId)
        .maybeSingle();

      if (existing?.id) {
        const oldLabel = typeof existing.label === "string" ? existing.label : "";
        const pieces = new Set(
          oldLabel
            .split("|")
            .map((ss) => ss.trim())
            .filter(Boolean),
        );
        for (const l of ltrLabels) pieces.add(l);
        const merged = Array.from(pieces).join("|");

        await supabase
          .from("media_rank_feature_log")
          .update({ label: merged })
          .eq("id", existing.id);
      }
    } catch {
      // ignore
    }
  }
};

const shouldRunBg = (() => {
  // Reduce write amplification at scale. Always record events, but sample heavy background work.
  const nonImpressions = rows.some((r) => String(r?.event_type ?? r?.eventType ?? "") !== "impression");
  if (hasStrongPositive) return Math.random() < 0.20;
  if (nonImpressions) return Math.random() < 0.10;
  return Math.random() < 0.02;
})();

const bg = shouldRunBg ? runBackgroundTasks().catch(() => null) : Promise.resolve(null);


// Supabase Edge Runtime supports waitUntil. Use it if present; otherwise just detach the promise.
const er = (globalThis as any).EdgeRuntime;
if (er && typeof er.waitUntil === "function") {
  er.waitUntil(bg);
}

    return new Response(
      JSON.stringify({ ok: true, sent: rows.length, items: bodies.length }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, code: "UNEXPECTED", message: (e as Error)?.message ?? "Unknown" }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" }, status: 500 },
    );
  }
});
