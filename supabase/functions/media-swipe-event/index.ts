// supabase/functions/media-swipe-event/index.ts
//
// Media-only Swipe Brain v2: event ingestion + lightweight online learning.
// Writes:
//  - public.media_events (append-only telemetry)
//  - public.media_feedback (latest state per user+media_item)
//  - public.media_session_vectors (session "mood" taste vector)
//  - public.media_user_vectors (long-term taste vector)
//
// Notes:
//  - This function is media_items-only (no titles table usage).
//  - Vector math is performed in JS to avoid relying on SQL vector arithmetic.
//  - If a media item doesn't have an embedding yet, the function still records
//    events/feedback and simply skips vector updates.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { handleOptions, jsonError, jsonResponse, validateRequest } from "../_shared/http.ts";
import { log } from "../_shared/logger.ts";
import { getAdminClient, getUserClient } from "../_shared/supabase.ts";

const FN_NAME = "media-swipe-event";

// Keep in sync with public.media_event_type enum
const MediaEventType = z.enum([
  "impression",
  "detail_open",
  "detail_close",
  "dwell",
  "like",
  "dislike",
  "skip",
  "watchlist_add",
  "watchlist_remove",
  "rating_set",
  "share",
]);

type MediaEventTypeT = z.infer<typeof MediaEventType>;

const RequestSchema = z.object({
  mediaItemId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventType: MediaEventType,

  // optional context
  deckId: z.string().uuid().optional().nullable(),
  position: z.number().int().min(0).max(5000).optional().nullable(),
  source: z.string().max(50).optional().nullable(),

  // optional metrics / state
  dwellMs: z.number().int().min(0).max(1000 * 60 * 60).optional().nullable(), // cap 1h
  rating: z.number().min(0).max(10).optional().nullable(),
  inWatchlist: z.boolean().optional().nullable(),

  // for future experimentation / clients
  payload: z.record(z.any()).optional().nullable(),
});

type ReqPayload = z.infer<typeof RequestSchema>;

// -----------------------------
// Vector helpers
// -----------------------------
const VECTOR_DIMS = 1024;

// pgvector text output comes back like: "[0.1,0.2,...]"
// Some drivers may return it as an array already. Handle both.
function parseVector(v: unknown): number[] | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const nums = v.map((x) => Number(x));
    return nums.length ? nums : null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    // Accept both [] and {} formats defensively
    const inner = s.replace(/^[\[\{]/, "").replace(/[\]\}]$/, "");
    if (!inner) return null;
    const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => Number.isNaN(n))) return null;
    return nums;
  }
  return null;
}

function vectorToSqlLiteral(vec: number[]): string {
  // pgvector accepts input like: '[1,2,3]'
  return `[${vec.join(",")}]`;
}

function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return vec;
  return vec.map((x) => x / norm);
}

function addScaled(base: number[], add: number[], scale: number): number[] {
  const n = Math.min(base.length, add.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = base[i] + add[i] * scale;
  return out;
}

function mulScalar(vec: number[], scalar: number): number[] {
  return vec.map((x) => x * scalar);
}

// -----------------------------
// Learning weights
// -----------------------------
function weightForEvent(p: ReqPayload): number {
  const t = p.eventType;
  switch (t) {
    case "like":
      return 2.0;
    case "dislike":
      return -2.5;
    case "skip":
      return -0.4;
    case "watchlist_add":
      return 2.5;
    case "watchlist_remove":
      return -1.0;
    case "share":
      return 3.0;
    case "detail_open":
      return 0.6;
    case "detail_close":
      return 0.0;
    case "rating_set": {
      const r = p.rating ?? 5;
      // Map 0..10 => roughly -2.5..+2.5
      return (r - 5) / 2;
    }
    case "dwell": {
      const ms = p.dwellMs ?? 0;
      const s = ms / 1000;
      // ignore micro-dwell noise; start learning after ~1.5s
      if (s < 1.5) return 0.0;
      // log1p for diminishing returns; cap at 2.0
      const w = Math.log1p(s);
      return Math.min(2.0, w);
    }
    case "impression":
    default:
      return 0.0;
  }
}

// For resurfacing/suppression, it's useful to store a coarse "stance" in media_feedback.
// We keep last_action aligned to like/dislike/skip as much as possible.
function derivedStanceForFeedback(p: ReqPayload): "like" | "dislike" | "skip" | null {
  switch (p.eventType) {
    case "like":
      return "like";
    case "dislike":
      return "dislike";
    case "skip":
      return "skip";
    case "watchlist_add":
    case "share":
      return "like";
    case "watchlist_remove":
      return "skip";
    case "rating_set": {
      const r = p.rating;
      if (r == null) return null;
      if (r >= 7) return "like";
      if (r <= 4) return "dislike";
      return "skip";
    }
    default:
      return null;
  }
}

// -----------------------------
// Main handler
// -----------------------------
export async function handler(req: Request): Promise<Response> {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const logCtx: Record<string, unknown> = { fn: FN_NAME };

  try {
    const userClient = getUserClient(req);
    const { data: { user }, error: authError } = await userClient.auth.getUser();

    if (authError || !user) {
      log(logCtx, "Authentication error", { error: authError?.message });
      return jsonError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const { data: payload, errorResponse } = await validateRequest<ReqPayload>(req, (raw) => RequestSchema.parse(raw), {
      logPrefix: `[${FN_NAME}]`,
    });

    if (errorResponse || !payload) return errorResponse!;

    const {
      mediaItemId,
      sessionId,
      deckId,
      position,
      source,
      eventType,
      dwellMs,
      rating,
      inWatchlist,
      payload: extraPayload,
    } = payload;

    logCtx.userId = user.id;
    logCtx.mediaItemId = mediaItemId;
    logCtx.eventType = eventType;

    // 1) Record event (append-only)
    const eventInsert = {
      user_id: user.id,
      session_id: sessionId,
      deck_id: deckId ?? null,
      position: position ?? null,
      media_item_id: mediaItemId,
      event_type: eventType,
      source: source ?? null,
      dwell_ms: dwellMs ?? null,
      payload: extraPayload ?? null,
    };

    const { error: eventErr } = await userClient.from("media_events").insert(eventInsert);

    if (eventErr) {
      log(logCtx, "Failed to insert media_events", { error: eventErr.message });
      return jsonError("Failed to record event", 500, "EVENT_INSERT_FAILED");
    }

    // 2) Update feedback (latest state)
    const stance = derivedStanceForFeedback(payload);
    const feedbackUpdate: Record<string, unknown> = {
      user_id: user.id,
      media_item_id: mediaItemId,
      last_action_at: new Date().toISOString(),
    };

    // Only update last_action when we have a meaningful stance (like/dislike/skip)
    if (stance) feedbackUpdate.last_action = stance;

    if (typeof rating === "number") feedbackUpdate.rating_0_10 = rating;

    // In-watchlist updates:
    // - explicit inWatchlist field wins
    // - otherwise infer from watchlist events
    if (typeof inWatchlist === "boolean") {
      feedbackUpdate.in_watchlist = inWatchlist;
    } else if (eventType === "watchlist_add") {
      feedbackUpdate.in_watchlist = true;
    } else if (eventType === "watchlist_remove") {
      feedbackUpdate.in_watchlist = false;
    }

    // Dwell
    if (typeof dwellMs === "number") feedbackUpdate.last_dwell_ms = dwellMs;

    const { error: fbErr } = await userClient
      .from("media_feedback")
      .upsert(feedbackUpdate, { onConflict: "user_id,media_item_id" });

    if (fbErr) {
      log(logCtx, "Failed to upsert media_feedback", { error: fbErr.message });
      // We already stored the event; don't fail the whole request.
    }

    // 3) Online vector update (session + long-term)
    const w = weightForEvent(payload);
    if (w === 0) {
      return jsonResponse({ ok: true });
    }

    const admin = getAdminClient();

    // Load the item embedding (service role read to avoid any privilege issues)
    const { data: embRow, error: embErr } = await admin
      .from("media_embeddings")
      .select("embedding")
      .eq("media_item_id", mediaItemId)
      .maybeSingle();

    if (embErr) {
      log(logCtx, "Failed to load media_embeddings", { error: embErr.message });
      return jsonResponse({ ok: true });
    }

    const itemVec = parseVector(embRow?.embedding);
    if (!itemVec || itemVec.length !== VECTOR_DIMS) {
      log(logCtx, "Embedding missing or wrong dims; skipping vector update", { dims: itemVec?.length ?? null });
      return jsonResponse({ ok: true });
    }

    // Session update (fast)
    // new_session = normalize(old*0.90 + item*w)
    const sessionDecay = 0.90;
    const sessionLR = 1.00;

    const { data: sessionRow } = await userClient
      .from("media_session_vectors")
      .select("taste")
      .eq("user_id", user.id)
      .eq("session_id", sessionId)
      .maybeSingle();

    const oldSession = parseVector(sessionRow?.taste) ?? new Array(VECTOR_DIMS).fill(0);
    const sessionBase = mulScalar(oldSession, sessionDecay);
    const newSession = l2Normalize(addScaled(sessionBase, itemVec, w * sessionLR));

    const { error: sessUpErr } = await userClient
      .from("media_session_vectors")
      .upsert(
        {
          user_id: user.id,
          session_id: sessionId,
          taste: vectorToSqlLiteral(newSession),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,session_id" },
      );

    if (sessUpErr) {
      log(logCtx, "Failed to upsert media_session_vectors", { error: sessUpErr.message });
      // don't fail request
    }

    // Long-term update (slow)
    // new_user = normalize(old*0.98 + item*(w*0.25))
    const userDecay = 0.98;
    const userLR = 0.25;

    const { data: userRow } = await userClient
      .from("media_user_vectors")
      .select("taste")
      .eq("user_id", user.id)
      .maybeSingle();

    const oldUser = parseVector(userRow?.taste) ?? new Array(VECTOR_DIMS).fill(0);
    const userBase = mulScalar(oldUser, userDecay);
    const newUser = l2Normalize(addScaled(userBase, itemVec, w * userLR));

    const { error: userUpErr } = await userClient
      .from("media_user_vectors")
      .upsert(
        {
          user_id: user.id,
          taste: vectorToSqlLiteral(newUser),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (userUpErr) {
      log(logCtx, "Failed to upsert media_user_vectors", { error: userUpErr.message });
      // don't fail request
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    log({ fn: FN_NAME }, "Unhandled error", { error: String(err?.message ?? err), stack: err?.stack });
    return jsonError("Internal error", 500, "INTERNAL_ERROR");
  }
}

serve(handler);
