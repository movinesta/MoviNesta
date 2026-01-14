import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

const BodySchema = z.object({
  user: z.string().min(1).max(320),
});

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function variantsToNames(variants: unknown): string[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((v) => String((v as any)?.name ?? "").trim())
    .filter(Boolean);
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc } = await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const needle = parsed.data.user.trim();
    let userId = needle;

    if (!isUuid(needle)) {
      const { data: users, error: userErr } = await svc
        .schema("auth")
        .from("users")
        .select("id,email")
        .ilike("email", needle)
        .limit(5);

      if (userErr) return json(req, 500, { ok: false, message: userErr.message });
      const match = (users ?? [])[0];
      if (!match?.id) return json(req, 404, { ok: false, message: "User not found" });
      userId = match.id;
    }

    const { data: experiments, error: expErr } = await svc
      .from("rec_experiments")
      .select("id,key,variants,status")
      .eq("status", "active")
      .order("key", { ascending: true });

    if (expErr) return json(req, 500, { ok: false, message: expErr.message });

    const expRows = experiments ?? [];
    if (!expRows.length) return json(req, 200, { ok: true, rows: [] });

    const experimentIds = expRows.map((row) => row.id);
    const { data: assignments, error: assignErr } = await svc
      .from("rec_user_experiment_assignments")
      .select("experiment_id,variant,assignment_mode")
      .eq("user_id", userId)
      .in("experiment_id", experimentIds);

    if (assignErr) return json(req, 500, { ok: false, message: assignErr.message });

    const assignmentMap = new Map(
      (assignments ?? []).map((row: any) => [row.experiment_id, row]),
    );

    for (const exp of expRows) {
      if (assignmentMap.has(exp.id)) continue;
      const { data: variant, error } = await svc.rpc("rec_assign_variant", {
        experiment_key: exp.key,
        user_id: userId,
      });
      if (!error && variant) {
        assignmentMap.set(exp.id, { experiment_id: exp.id, variant, assignment_mode: "auto" });
      }
    }

    const rows = expRows.map((exp: any) => {
      const assignment = assignmentMap.get(exp.id) ?? { variant: "control", assignment_mode: "auto" };
      return {
        user_id: userId,
        experiment_key: exp.key,
        variant: assignment.variant,
        assignment_mode: assignment.assignment_mode ?? "auto",
        available_variants: variantsToNames(exp.variants),
      };
    });

    return json(req, 200, { ok: true, rows });
  } catch (e) {
    return jsonError(req, e);
  }
});
