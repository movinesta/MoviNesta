import { serve } from "jsr:@std/http@0.224.0/server";
import { requireAdmin, json, handleCors, jsonError, HttpError } from "../_shared/admin.ts";
import { loadOpenRouterParametersCache } from "../_shared/openrouterAdmin.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const url = new URL(req.url);

    const modelId = url.searchParams.get("model") ?? "";
    if (!modelId.trim()) throw new HttpError(400, "Missing required query param: model");

    const provider = url.searchParams.get("provider");
    const baseUrl = url.searchParams.get("base_url") ?? null;

    const data = await loadOpenRouterParametersCache(svc, modelId.trim(), provider ? provider.trim() : null, baseUrl);

    return json(req, 200, { ok: true, ...data });
  } catch (e) {
    return jsonError(req, e);
  }
});
