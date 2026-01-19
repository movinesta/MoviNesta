/**
 * onboarding-initial-likes
 *
 * App-side onboarding helper:
 * - Accepts a list of media_item_id UUIDs the user says they like.
 * - Writes 'like' events (deduped) so taste vectors learn immediately.
 * - Best-effort: calls media_update_taste_vectors_v1 for each item.
 * - Best-effort: refreshes user centroids once at the end.
 *
 * Request body:
 * {
 *   sessionId: string,
 *   mediaItemIds: string[],  // 1..20
 *   preferredGenres?: string[], // optional (1..20) persisted to public.user_preferences (recsys column)
 *   deckId?: string,         // optional (client can keep)
 *   source?: string          // optional tag (default: 'onboarding')
 * }
 */

import { serve } from "jsr:@std/http@0.224.0/server";
import { createClient } from "supabase";
import { loadAppSettingsForScopes } from "../_shared/appSettings.ts";
import { getDefaultSettingsForScope } from "../_shared/appSettingsSchema.ts";
import { getConfig } from "../_shared/config.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function randomUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function utcDay(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });

	try {
		const cfg = getConfig();
		const SUPABASE_URL = cfg.supabaseUrl;
		const SUPABASE_ANON_KEY = cfg.supabaseAnonKey;
		const apiKeyHeader = (req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "").trim();
		const authHeader = req.headers.get("Authorization") ?? "";

		const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
			global: {
				headers: {
					...(authHeader ? { Authorization: authHeader } : {}),
					apikey: SUPABASE_ANON_KEY,
				},
			},
			auth: { persistSession: false, autoRefreshToken: false },
		});

		// Server-only recsys knobs (admin-controlled) for centroid refresh defaults.
		const SERVICE_KEY = cfg.supabaseServiceRoleKey ?? "";
		const svc = SERVICE_KEY
			? createClient(SUPABASE_URL, SERVICE_KEY, {
				auth: { persistSession: false, autoRefreshToken: false },
				global: { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
			})
			: null;

		// Basic safety check: require a Supabase key header so misconfigured clients fail fast.
		// (Edge runtime does not always implicitly validate apikey during key transitions.)
		if (!apiKeyHeader || (apiKeyHeader !== SUPABASE_ANON_KEY && apiKeyHeader !== SERVICE_KEY)) {
			return json(401, { ok: false, code: "INVALID_APIKEY" });
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

    const centroidK = Math.min(10, Math.max(1, Number((serverOnly as any)["ranking.swipe.centroids.k"] ?? 3) || 3));
    const centroidMaxItems = Math.min(200, Math.max(10, Number((serverOnly as any)["ranking.swipe.centroids.max_items"] ?? 60) || 60));

		// Verify the caller token is valid (verify_jwt may be disabled for JWT Signing Keys).
		let userId: string | null = null;
		const authAny = supabase.auth as any;
		const jwt = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
		if (!jwt) return json(401, { ok: false, code: "UNAUTHORIZED" });

		if (typeof authAny?.getClaims === "function") {
			const { data, error } = await authAny.getClaims(jwt);
			const sub = data?.claims?.sub;
			if (error || typeof sub !== "string" || !sub) return json(401, { ok: false, code: "UNAUTHORIZED" });
			userId = sub;
		} else {
			const { data: auth, error: authErr } = await supabase.auth.getUser();
			if (authErr || !auth?.user) return json(401, { ok: false, code: "UNAUTHORIZED" });
			userId = auth.user.id;
		}

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { ok: false, code: "BAD_JSON" });

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId) return json(400, { ok: false, code: "MISSING_SESSION" });

    const deckId = typeof body.deckId === "string" && body.deckId.trim() ? body.deckId.trim() : randomUuid();
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "onboarding";

    const mediaItemIdsRaw = Array.isArray(body.mediaItemIds) ? body.mediaItemIds : [];
    const mediaItemIds = uniq(mediaItemIdsRaw.map((x: any) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)).slice(0, 20);

    const preferredGenresRaw = Array.isArray(body.preferredGenres) ? body.preferredGenres : [];
    const preferredGenres = uniq(
      preferredGenresRaw.map((x: any) => (typeof x === "string" ? x.trim() : "")).filter(Boolean),
    ).slice(0, 20);

    if (!mediaItemIds.length) return json(400, { ok: false, code: "MISSING_MEDIA_ITEM_IDS" });

    // Best-effort: persist onboarding genre preferences (does not block likes insertion)
    if (preferredGenres.length) {
      try {
        const { data: existingRow } = await supabase
          .from("user_preferences")
          .select("recsys")
	        	  .eq("user_id", userId)
          .maybeSingle();

        const currentRecsys = (existingRow?.recsys as any) || {};
        const currentGenres = Array.isArray(currentRecsys.preferredGenres) ? currentRecsys.preferredGenres : [];
        const merged = uniq([...currentGenres, ...preferredGenres]).slice(0, 50);

        const updatedRecsys = { ...currentRecsys, preferredGenres: merged };

        await supabase.from("user_preferences").upsert(
          {
	        	  user_id: userId,
            recsys: updatedRecsys,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      } catch {
        // ignore
      }
    }

    const day = utcDay();

    const rows = mediaItemIds.map((id, idx) => ({
	  user_id: userId,
      session_id: sessionId,
      deck_id: deckId,
      position: idx,
      media_item_id: id,
      event_type: "like",
      source,
      dwell_ms: null,
      rating_0_10: null,
      in_watchlist: null,
      client_event_id: null,
      payload: { onboarding: true },
      event_day: day,
      dedupe_key: `onb:${day}:${id}`,
    }));

    // Insert events with dedupe.
    const { error: upsertErr } = await supabase
      .from("media_events")
      .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

    if (upsertErr) {
      return json(500, { ok: false, code: "UPSERT_FAILED", message: upsertErr.message });
    }

    // Best-effort: update taste vectors for each event.
    for (const id of mediaItemIds) {
      try {
        const { error: tasteErr } = await supabase.rpc("media_update_taste_vectors_v1", {
          p_session_id: sessionId,
          p_media_item_id: id,
          p_event_type: "like",
          p_dwell_ms: null,
          p_rating_0_10: null,
          p_in_watchlist: null,
        });
        void tasteErr;
      } catch {
        // ignore
      }
    }

    // Best-effort: refresh centroids (multi-taste) so "for_you" becomes meaningful quickly.
    try {
      const { error: cErr } = await supabase.rpc("media_refresh_user_centroids_v1", { p_k: centroidK, p_max_items: centroidMaxItems });
      void cErr;
    } catch {
      // ignore
    }

    return json(200, { ok: true, deckId, inserted: rows.length });
  } catch (err) {
    return json(500, {
      ok: false,
      code: "INTERNAL_ERROR",
      message: String((err as any)?.message ?? err),
    });
  }
});
