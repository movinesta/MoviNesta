/**
 * media-embed-backfill — Auto Pagination via DB state (no afterId required)
 *
 * Your logs show repeated calls with afterId:null, which re-scan the same first page forever.
 * This version stores a cursor in public.media_job_state(job_name='media-embed-backfill') and uses it automatically.
 *
 * Behavior:
 * - effectiveAfterId = body.afterId ?? (body.useSavedCursor !== false ? db cursor : null)
 * - after each run (even if 0 embedded), cursor is updated to next_after_id
 * - when next_after_id is null, cursor is set to null (job finished)
 *
 * Inputs:
 * { batchSize?: number, afterId?: string, reembed?: boolean, kind?: string, useSavedCursor?: boolean }
 *
 * Outputs:
 * { ok, scanned, embedded, skipped_existing, next_after_id, used_after_id, cursor_saved }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { JINA_API_KEY, JINA_EMBEDDINGS_URL, JINA_MODEL, JINA_DIM } from "../_shared/config.ts";
import { postJson } from "../_shared/http.ts";
import { buildSwipeDocTSV } from "../_shared/jina_tsv_doc.ts";

type EmbeddingResp = {
  data?: Array<{ embedding: number[] }>;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));

function respond(status: number, body: any) {
  if (status >= 400) console.error("MEDIA_EMBED_BACKFILL_ERROR", JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function callJina(docs: string[]): Promise<number[][]> {
  const headers = JINA_API_KEY ? { Authorization: `Bearer ${JINA_API_KEY}` } : {};
  const payload = { model: JINA_MODEL, input: docs };

  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = (await postJson(JINA_EMBEDDINGS_URL, payload, headers)) as EmbeddingResp;
      return resp.data?.map((d) => d.embedding) ?? [];
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(attempt === 1 ? 250 : 600);
    }
  }

  throw lastErr ?? new Error("Unknown Jina error");
}

async function getSavedCursor(supabase: any): Promise<string | null> {
  const { data, error } = await supabase
    .from("media_job_state")
    .select("cursor")
    .eq("job_name", "media-embed-backfill")
    .maybeSingle();

  if (error) {
    // If table doesn't exist yet, behave like "no cursor".
    console.warn("MEDIA_EMBED_BACKFILL_WARN saved cursor read failed:", error.message);
    return null;
  }
  return data?.cursor ? String(data.cursor) : null;
}

async function saveCursor(supabase: any, cursor: string | null): Promise<boolean> {
  const { error } = await supabase
    .from("media_job_state")
    .upsert(
      { job_name: "media-embed-backfill", cursor, updated_at: new Date().toISOString() },
      { onConflict: "job_name" },
    );

  if (error) {
    console.warn("MEDIA_EMBED_BACKFILL_WARN cursor save failed:", error.message);
    return false;
  }
  return true;
}

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const batchSize = clamp(Number(body.batchSize ?? 32), 1, 120);
    const explicitAfterId = typeof body.afterId === "string" ? body.afterId : null;
    const useSavedCursor = body.useSavedCursor === false ? false : true;
    const reembed = Boolean(body.reembed ?? false);
    const kindFilter = typeof body.kind === "string" ? body.kind : null;

    const savedCursor = useSavedCursor && !explicitAfterId ? await getSavedCursor(supabase) : null;
    const usedAfterId = explicitAfterId ?? savedCursor;

    console.log(
      "MEDIA_EMBED_BACKFILL_START",
      JSON.stringify({ batchSize, afterId: usedAfterId, reembed, kindFilter, useSavedCursor }),
    );

    let q = supabase
      .from("media_items")
      .select(
        [
          "id",
          "kind",
          "tmdb_release_date",
          "tmdb_first_air_date",
          "tmdb_overview",
          "tmdb_original_language",
          "tmdb_raw",
          "omdb_year",
          "omdb_plot",
          "omdb_genre",
          "omdb_language",
          "omdb_country",
          "omdb_actors",
          "omdb_director",
          "omdb_writer",
          "omdb_rated",
          "completeness",
        ].join(","),
      )
      .order("id", { ascending: true })
      .limit(batchSize);

    if (usedAfterId) q = q.gt("id", usedAfterId);
    if (kindFilter) q = q.eq("kind", kindFilter);

    const { data: items, error: itemsErr } = await q;
    if (itemsErr) return respond(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });

    if (!items?.length) {
      const cursorSaved = useSavedCursor ? await saveCursor(supabase, null) : false;
      return respond(200, {
        ok: true,
        scanned: 0,
        embedded: 0,
        skipped_existing: 0,
        next_after_id: null,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
      });
    }

    let todo = items as any[];
    let skippedExisting = 0;

    if (!reembed) {
      const ids = todo.map((x) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .in("media_item_id", ids);

      if (exErr) return respond(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = todo.filter((x) => !have.has(x.id));
      skippedExisting = items.length - todo.length;
    }

    const nextAfterId = items.length === batchSize ? String(items[items.length - 1].id) : null;

    // Save cursor even if we didn't embed anything (prevents infinite "skip existing first page" loops)
    const cursorSaved = useSavedCursor ? await saveCursor(supabase, nextAfterId) : false;

    if (!todo.length) {
      console.log("MEDIA_EMBED_BACKFILL_SKIP_ALL_EXISTING", JSON.stringify({ scanned: items.length, nextAfterId }));
      return respond(200, {
        ok: true,
        scanned: items.length,
        embedded: 0,
        skipped_existing: skippedExisting,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
        reembed,
      });
    }

    const docs = todo.map((mi) => buildSwipeDocTSV(mi));

    let vecs: number[][];
    try {
      vecs = await callJina(docs);
    } catch (err) {
      return respond(500, {
        ok: false,
        code: "JINA_CALL_FAILED",
        message: String((err as any)?.message ?? err),
        model: JINA_MODEL,
        url: JINA_EMBEDDINGS_URL,
        batchSize: docs.length,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
      });
    }

    if (vecs.length !== todo.length) {
      return respond(500, {
        ok: false,
        code: "JINA_MISMATCH",
        message: `got ${vecs.length} embeddings for ${todo.length} docs`,
        model: JINA_MODEL,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
      });
    }

    const expectedDim = Number.isFinite(JINA_DIM) && JINA_DIM > 0 ? JINA_DIM : 1024;
    const badDim = vecs.findIndex((v) => (Array.isArray(v) ? v.length : 0) !== expectedDim);
    if (badDim !== -1) {
      return respond(500, {
        ok: false,
        code: "EMBEDDING_DIM_MISMATCH",
        message: `embedding dim mismatch at index ${badDim}: got ${vecs[badDim]?.length}, expected ${expectedDim}`,
        model: JINA_MODEL,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
      });
    }

    const rows = todo.map((mi, i) => ({
      media_item_id: mi.id,
      embedding: vecs[i],
      model: JINA_MODEL,
      task: "swipe",
      updated_at: new Date().toISOString(),
    }));

    const { error: upErr } = await supabase
      .from("media_embeddings")
      .upsert(rows, { onConflict: "media_item_id" });

    if (upErr) {
      return respond(500, {
        ok: false,
        code: "UPSERT_FAILED",
        message: upErr.message,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
      });
    }

    console.log("MEDIA_EMBED_BACKFILL_OK", JSON.stringify({ scanned: items.length, embedded: rows.length, nextAfterId }));

    return respond(200, {
      ok: true,
      scanned: items.length,
      embedded: rows.length,
      skipped_existing: skippedExisting,
      next_after_id: nextAfterId,
      used_after_id: usedAfterId,
      cursor_saved: cursorSaved,
      reembed,
    });
  } catch (err) {
    return respond(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
