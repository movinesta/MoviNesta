import { serve } from "jsr:@std/http@0.224.0/server";
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

    const data = await loadOpenRouterCache(svc, "endpoints", baseUrl);
    const zdrEndpoints = summarizeZdrEndpoints(data.payload);

    return json(req, 200, { ok: true, ...data, zdr_endpoints: zdrEndpoints, zdr_total: zdrEndpoints.length });
  } catch (e) {
    return jsonError(req, e);
  }
});
