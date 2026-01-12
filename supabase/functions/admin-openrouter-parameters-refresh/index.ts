import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { getConfig } from "../_shared/config.ts";
import { fetchJsonWithTimeout } from "../_shared/fetch.ts";
import {
  readOpenRouterParametersCache,
  resolveOpenRouterBaseUrl,
  writeOpenRouterParametersCache,
} from "../_shared/openrouterCache.ts";

function parseModelPath(modelId: string): { author: string; slug: string } {
  // OpenRouter model ids can include suffixes like ":free". The parameters endpoint expects author/slug.
  const clean = modelId.split(":")[0];
  const parts = clean.split("/").map((s) => s.trim()).filter(Boolean);
  const author = parts.shift() ?? "";
  const slug = parts.join("/");
  if (!author || !slug) {
    throw new Error("Invalid model id. Expected 'author/slug'.");
  }
  return { author, slug };
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const url = new URL(req.url);

    const modelId = (url.searchParams.get("model") ?? "").trim();
    const provider = (url.searchParams.get("provider") ?? "").trim() || null;
    const baseUrlOverride = (url.searchParams.get("base_url") ?? "").trim() || null;

    if (!modelId) {
      return json(req, 400, { ok: false, error: "missing_model" });
    }

    const cfg = getConfig();
    const apiKey = cfg.openrouterApiKey;
    if (!apiKey) {
      return json(req, 500, { ok: false, error: "missing_openrouter_api_key" });
    }

    const baseUrl = await resolveOpenRouterBaseUrl(svc, baseUrlOverride);
    const { author, slug } = parseModelPath(modelId);

    const qs: string[] = [];
    if (provider) qs.push(`provider=${encodeURIComponent(provider)}`);
    const endpoint = `${baseUrl}/parameters/${encodeURIComponent(author)}/${encodeURIComponent(slug)}${qs.length ? `?${qs.join("&")}` : ""}`;

    const payload = await fetchJsonWithTimeout(
      endpoint,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://movinesta.app/",
          "X-Title": "MoviNesta Admin",
        },
      },
      12_000,
    );

    await writeOpenRouterParametersCache(svc, baseUrl, modelId, provider, payload);

    const row = await readOpenRouterParametersCache(svc, baseUrl, modelId, provider);
    return json(req, 200, {
      ok: true,
      refreshed: true,
      base_url: baseUrl,
      model_id: modelId,
      provider,
      fetched_at: row?.fetched_at ?? null,
      payload: row?.payload ?? payload ?? null,
    });
  } catch (e) {
    return jsonError(req, e);
  }
});
