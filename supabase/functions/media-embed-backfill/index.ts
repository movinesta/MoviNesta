/**
 * media-embed-backfill — Voyage-only embeddings backfill
 *
 * Locked provider/models for this repo:
 * - provider: voyage
 * - model:    voyage-3-large
 *
 * Inputs (JSON):
 * {
 *   batchSize?: number,
 *   afterId?: string,
 *   kind?: string,
 *   reembed?: boolean,
 *   useSavedCursor?: boolean,
 *   jobName?: string,
 *   task?: string
 * }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { VOYAGE_DIM, VOYAGE_EMBED_MODEL, VOYAGE_EMBEDDINGS_URL } from "../_shared/config.ts";
import { buildSwipeDocTSV } from "../_shared/media_doc_tsv.ts";
import { voyageEmbed } from "../_shared/voyage.ts";
import { safeInsertJobRunLog } from "../_shared/joblog.ts";
import { handleCors, requireAdmin } from "../_shared/admin.ts";

const PROVIDER = "voyage";
const MODEL = VOYAGE_EMBED_MODEL;
const DIMENSIONS = VOYAGE_DIM;

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(n, b));

function respond(status: number, body: any) {
  if (status >= 400) console.error("MEDIA_EMBED_BACKFILL_ERROR", JSON.stringify(body));
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function fnv1a32(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function makeJobName(profile: {
  model: string;
  dimensions: number;
  task: string;
  kind: string | null;
}): string {
  const base = `media-embed-backfill|provider=${PROVIDER}|model=${profile.model}|dim=${profile.dimensions}|task=${profile.task}|kind=${profile.kind ?? ""}`;
  if (base.length <= 180) return base;
  return `${base.slice(0, 160)}|h=${fnv1a32(base)}`;
}

async function getSavedCursor(supabase: any, jobName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("media_job_state")
    .select("cursor")
    .eq("job_name", jobName)
    .maybeSingle();

  if (error) {
    console.warn("MEDIA_EMBED_BACKFILL_WARN cursor read failed:", error.message);
    return null;
  }

  if (data?.cursor) return String(data.cursor);

  // Back-compat: read old single cursor if present (first run only).
  if (jobName !== "media-embed-backfill") {
    const { data: legacy, error: legErr } = await supabase
      .from("media_job_state")
      .select("cursor")
      .eq("job_name", "media-embed-backfill")
      .maybeSingle();

    if (!legErr && legacy?.cursor) return String(legacy.cursor);
  }

  return null;
}

async function saveCursor(supabase: any, jobName: string, cursor: string | null): Promise<boolean> {
  const { error } = await supabase
    .from("media_job_state")
    .upsert({ job_name: jobName, cursor, updated_at: new Date().toISOString() }, { onConflict: "job_name" });

  if (error) {
    console.warn("MEDIA_EMBED_BACKFILL_WARN cursor save failed:", error.message);
    return false;
  }
  return true;
}

serve(async (req) => {
  const startedAt = new Date().toISOString();
  let jobNameForLog = "media-embed-backfill";

  const respondWithLog = async (status: number, body: any) => {
    try {
      const finishedAt = new Date().toISOString();
      const ok = Boolean(body?.ok);
      const scanned = typeof body?.scanned === "number" ? body.scanned : null;
      const embedded = typeof body?.embedded === "number" ? body.embedded : null;
      const skipped_existing = typeof body?.skipped_existing === "number" ? body.skipped_existing : null;
      const total_tokens = typeof body?.total_tokens === "number" ? body.total_tokens : null;
      const error_code = body?.code ?? body?.error_code ?? null;
      const error_message = body?.message ?? body?.error_message ?? null;

      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      await safeInsertJobRunLog(supabase, {
        started_at: startedAt,
        finished_at: finishedAt,
        job_name: jobNameForLog,
        provider: PROVIDER,
        model: MODEL,
        ok,
        scanned,
        embedded,
        skipped_existing,
        total_tokens,
        error_code,
        error_message,
        meta: {
          batchSize: body?.batchSize ?? undefined,
          dimensions: DIMENSIONS,
          task: body?.task ?? undefined,
          reembed: body?.reembed ?? undefined,
          kind: body?.kindFilter ?? body?.kind ?? undefined,
          used_after_id: body?.used_after_id ?? undefined,
          next_after_id: body?.next_after_id ?? undefined,
          cursor_saved: body?.cursor_saved ?? undefined,
          url: body?.url ?? undefined,
        },
      });
    } catch {
      // best-effort
    }
    return respond(status, body);
  };

  try {
    const cors = handleCors(req);
    if (cors) return cors;

    // Admin-only operation
    await requireAdmin(req);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    const batchSize = clamp(Number(body.batchSize ?? 32), 1, 256);
    const task = typeof body.task === "string" && body.task.trim() ? body.task.trim() : "swipe";
    const reembed = Boolean(body.reembed ?? false);
    const kindFilter = typeof body.kind === "string" ? body.kind : null;

    const useSavedCursor = body.useSavedCursor === false ? false : true;
    const explicitAfterId = typeof body.afterId === "string" && body.afterId ? body.afterId : null;

    const derivedJobName = makeJobName({ model: MODEL, dimensions: DIMENSIONS, task, kind: kindFilter });
    const jobName = typeof body.jobName === "string" && body.jobName.trim() ? body.jobName.trim() : derivedJobName;
    jobNameForLog = jobName;

    const savedCursor = useSavedCursor && !explicitAfterId ? await getSavedCursor(supabase, jobName) : null;
    const usedAfterId = explicitAfterId ?? savedCursor;

    console.log(
      "MEDIA_EMBED_BACKFILL_START",
      JSON.stringify({ jobName, provider: PROVIDER, model: MODEL, dimensions: DIMENSIONS, task, batchSize, afterId: usedAfterId, reembed, kindFilter, useSavedCursor }),
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
    if (itemsErr) return await respondWithLog(500, { ok: false, code: "FETCH_FAILED", message: itemsErr.message });

    if (!items?.length) {
      const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, null) : false;
      return await respondWithLog(200, {
        ok: true,
        scanned: 0,
        embedded: 0,
        skipped_existing: 0,
        next_after_id: null,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        task,
        reembed,
        total_tokens: 0,
      });
    }

    const nextAfterId = items.length === batchSize ? String(items[items.length - 1].id) : null;

    const docs = items.map((mi: any) => buildSwipeDocTSV(mi));
    let todo = items.map((mi: any, i: number) => ({ ...mi, __doc: docs[i] }));

    // Skip existing rows for this profile unless reembed=true
    let skippedExisting = 0;
    if (!reembed) {
      const ids = todo.map((x: any) => x.id);
      const { data: existing, error: exErr } = await supabase
        .from("media_embeddings")
        .select("media_item_id")
        .eq("provider", PROVIDER)
        .eq("model", MODEL)
        .eq("dimensions", DIMENSIONS)
        .eq("task", task)
        .in("media_item_id", ids);

      if (exErr) return await respondWithLog(500, { ok: false, code: "EXISTING_CHECK_FAILED", message: exErr.message });

      const have = new Set((existing ?? []).map((r: any) => r.media_item_id));
      todo = todo.filter((x: any) => !have.has(x.id));
      skippedExisting = items.length - todo.length;
    }

    // If all existing, advance cursor to prevent infinite loops
    if (!todo.length) {
      const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, nextAfterId) : false;
      console.log("MEDIA_EMBED_BACKFILL_SKIP_ALL_EXISTING", JSON.stringify({ scanned: items.length, nextAfterId, jobName }));
      return await respondWithLog(200, {
        ok: true,
        scanned: items.length,
        embedded: 0,
        skipped_existing: skippedExisting,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: cursorSaved,
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        task,
        reembed,
        total_tokens: 0,
      });
    }

    // Call Voyage embeddings
    let vecs: number[][] = [];
    let totalTokens: number | null = null;

    try {
      const todoDocs = todo.map((x: any) => x.__doc as string);
      const res = await voyageEmbed(todoDocs, {
        model: MODEL,
        inputType: "document",
        outputDimension: DIMENSIONS,
        truncation: true,
      });
      vecs = res.embeddings;
      totalTokens = res.totalTokens;
    } catch (err) {
      return await respondWithLog(500, {
        ok: false,
        code: "EMBEDDINGS_CALL_FAILED",
        message: String((err as any)?.message ?? err),
        provider: PROVIDER,
        model: MODEL,
        url: VOYAGE_EMBEDDINGS_URL,
        batchSize,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    if (vecs.length !== todo.length) {
      return await respondWithLog(500, {
        ok: false,
        code: "EMBEDDINGS_COUNT_MISMATCH",
        message: `got ${vecs.length} embeddings for ${todo.length} docs`,
        provider: PROVIDER,
        model: MODEL,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    const badDim = vecs.findIndex((v) => (Array.isArray(v) ? v.length : 0) !== DIMENSIONS);
    if (badDim !== -1) {
      return await respondWithLog(500, {
        ok: false,
        code: "EMBEDDING_DIM_MISMATCH",
        message: `embedding dim mismatch at index ${badDim}: got ${vecs[badDim]?.length}, expected ${DIMENSIONS}`,
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    // Upsert rows for this profile
    const now = new Date().toISOString();
    const rows = todo.map((mi: any, i: number) => ({
      media_item_id: mi.id,
      provider: PROVIDER,
      model: MODEL,
      dimensions: DIMENSIONS,
      task,
      embedding: vecs[i],
      updated_at: now,
    }));

    const { error: upErr } = await supabase
      .from("media_embeddings")
      .upsert(rows, { onConflict: "media_item_id,provider,model,dimensions,task" });

    if (upErr) {
      return await respondWithLog(500, {
        ok: false,
        code: "UPSERT_FAILED",
        message: upErr.message,
        provider: PROVIDER,
        model: MODEL,
        dimensions: DIMENSIONS,
        task,
        next_after_id: nextAfterId,
        used_after_id: usedAfterId,
        cursor_saved: false,
      });
    }

    const cursorSaved = useSavedCursor ? await saveCursor(supabase, jobName, nextAfterId) : false;

    console.log(
      "MEDIA_EMBED_BACKFILL_OK",
      JSON.stringify({ scanned: items.length, embedded: rows.length, skippedExisting, nextAfterId, jobName, provider: PROVIDER, model: MODEL, dimensions: DIMENSIONS, task, totalTokens }),
    );

    return await respondWithLog(200, {
      ok: true,
      scanned: items.length,
      embedded: rows.length,
      skipped_existing: skippedExisting,
      next_after_id: nextAfterId,
      used_after_id: usedAfterId,
      cursor_saved: cursorSaved,
      provider: PROVIDER,
      model: MODEL,
      dimensions: DIMENSIONS,
      task,
      reembed,
      total_tokens: totalTokens,
    });
  } catch (err) {
    return await respondWithLog(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});