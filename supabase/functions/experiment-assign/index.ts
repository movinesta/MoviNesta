/**
 * experiment-assign
 *
 * Returns stable A/B assignments for the authenticated user.
 *
 * Security:
 * - Verifies the caller via Supabase Auth (anon key + Authorization header).
 * - Reads active experiments and writes assignments using the service_role client.
 * - Clients cannot force variants because assignments are written server-side with service_role.
 *
 * Request body:
 * {
 *   keys: string[]; // experiment keys to assign (max 20)
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   assignments: Record<string, string>
 * }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

type Variant = { name: string; weight: number };

function parseVariants(input: any): Variant[] {
  if (!Array.isArray(input)) return [{ name: "control", weight: 1 }];
  const out: Variant[] = [];
  for (const v of input) {
    const name = typeof v?.name === "string" ? v.name.trim() : "";
    const weight = typeof v?.weight === "number" ? v.weight : Number(v?.weight);
    if (!name) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    out.push({ name, weight });
  }
  return out.length ? out : [{ name: "control", weight: 1 }];
}

async function stableUnitInterval(seed: string): Promise<number> {
  const data = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  // Use first 8 bytes as unsigned bigint, map to [0,1)
  let x = 0n;
  for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(bytes[i]);
  const max = 2n ** 64n;
  return Number(x) / Number(max);
}

async function chooseVariant(userId: string, expKey: string, salt: string, variantsJson: any) {
  const variants = parseVariants(variantsJson);
  const total = variants.reduce((s, v) => s + v.weight, 0);
  const u = await stableUnitInterval(`${userId}|${expKey}|${salt}`);
  let t = u * total;
  for (const v of variants) {
    t -= v.weight;
    if (t <= 0) return v.name;
  }
  return variants[variants.length - 1].name;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  try {
    const cfg = getConfig();
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey);

    const { data: auth, error: authErr } = await userClient.auth.getUser();
    if (authErr || !auth?.user) return json(401, { ok: false, code: "UNAUTHORIZED" });

    const body = await req.json().catch(() => null);
    const keysRaw = Array.isArray(body?.keys) ? body.keys : [];
    const keys = keysRaw
      .map((k: any) => (typeof k === "string" ? k.trim() : ""))
      .filter(Boolean)
      .slice(0, 20);

    if (!keys.length) return json(200, { ok: true, assignments: {} });

    // Fetch active experiments
    const { data: exps, error: expErr } = await serviceClient
      .from("rec_experiments")
      .select("id,key,status,variants,salt")
      .in("key", keys)
      .eq("status", "active");

    if (expErr) return json(500, { ok: false, code: "EXPERIMENT_QUERY_FAILED", message: expErr.message });

    const expByKey = new Map<string, any>();
    for (const e of exps ?? []) {
      if (e?.key) expByKey.set(e.key, e);
    }

    const assignments: Record<string, string> = {};

    for (const key of keys) {
      const exp = expByKey.get(key);
      if (!exp) continue;

      // Existing assignment?
      const { data: existing, error: existingErr } = await serviceClient
        .from("rec_user_experiment_assignments")
        .select("variant")
        .eq("experiment_id", exp.id)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (existingErr) {
        // If read fails, skip rather than fail the whole request.
        continue;
      }
      if (existing?.variant) {
        assignments[key] = existing.variant;
        continue;
      }

      const variant = await chooseVariant(auth.user.id, key, exp.salt ?? "", exp.variants);

      // Write assignment (idempotent)
      const { error: upErr } = await serviceClient
        .from("rec_user_experiment_assignments")
        .upsert({ experiment_id: exp.id, user_id: auth.user.id, variant }, { onConflict: "experiment_id,user_id" });

      if (!upErr) assignments[key] = variant;
    }

    return json(200, { ok: true, assignments });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
