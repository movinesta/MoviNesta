import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";
import { loadOpenRouterCache } from "../_shared/openrouterAdmin.ts";
import { summarizeZdrEndpoints } from "../_shared/openrouterZdr.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const url = new URL(req.url);
    const baseUrl = url.searchParams.get("base_url") ?? null;

    const data = await loadOpenRouterCache(svc, "openrouter_endpoints_cache", baseUrl);
    const zdrEndpoints = summarizeZdrEndpoints(data.payload);

    return json(req, 200, { ok: true, ...data, zdr_endpoints: zdrEndpoints, zdr_total: zdrEndpoints.length });
  } catch (e) {
    return jsonError(req, e);
  }
});
