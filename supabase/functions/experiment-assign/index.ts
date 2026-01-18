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

import { serve } from "jsr:@std/http@0.224.0/server";
import { createClient } from "supabase";
import { getConfig } from "../_shared/config.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers":
        "authorization, x-client-info, apikey, content-type, x-request-id, x-runner-job-id",
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
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const apiKeyHeader = (req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "").trim();
    const hasBearer = /^Bearer\s+.+/i.test(authHeader.trim());
    if (!hasBearer) {
      if (!apiKeyHeader || (apiKeyHeader !== cfg.supabaseAnonKey && apiKeyHeader !== cfg.supabaseServiceRoleKey)) {
        return json(401, { ok: false, code: "INVALID_APIKEY" });
      }
    }

    const userClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      global: {
        headers: {
          ...(authHeader ? { Authorization: authHeader } : {}),
          apikey: cfg.supabaseAnonKey,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
      global: {
        headers: {
          apikey: cfg.supabaseServiceRoleKey,
          Authorization: `Bearer ${cfg.supabaseServiceRoleKey}`,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify the caller token is valid (verify_jwt may be disabled for JWT Signing Keys).
    let userId: string | null = null;
    const jwt = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
    const authAny = userClient.auth as any;
    if (jwt && typeof authAny?.getClaims === "function") {
      const { data: claims, error } = await authAny.getClaims(jwt);
      const sub = claims?.claims?.sub;
      if (!error && typeof sub === "string" && sub) userId = sub;
    }
    if (!userId) {
      const { data: auth, error: authErr } = await userClient.auth.getUser();
      userId = auth?.user?.id ?? null;
      if (authErr || !userId) return json(401, { ok: false, code: "UNAUTHORIZED" });
    }

    const uid = userId;

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
        .eq("user_id", userId)
        .maybeSingle();

      if (existingErr) {
        // If read fails, skip rather than fail the whole request.
        continue;
      }
      if (existing?.variant) {
        assignments[key] = existing.variant;
        continue;
      }

      const variant = await chooseVariant(uid, key, exp.salt ?? "", exp.variants);

      // Write assignment (idempotent)
      const { error: upErr } = await serviceClient
        .from("rec_user_experiment_assignments")
        .upsert({ experiment_id: exp.id, user_id: uid, variant }, { onConflict: "experiment_id,user_id" });

      if (!upErr) assignments[key] = variant;
    }

    return json(200, { ok: true, assignments });
  } catch (err) {
    return json(500, { ok: false, code: "INTERNAL_ERROR", message: String((err as any)?.message ?? err) });
  }
});
