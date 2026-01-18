import { serve } from "jsr:@std/http@0.224.0/server";
import { z } from "zod";
import { requireAdmin, json, handleCors, jsonError } from "../_shared/admin.ts";

/**
 * Admin endpoint: returns (experiment_key -> assigned variant) rows for a target user.
 *
 * IMPORTANT FIX:
 * - Do NOT query auth.users via PostgREST (svc.schema("auth").from("users")) because the "auth" schema
 *   is not exposed by PostgREST in Supabase projects by default. That pattern causes 500 errors.
 * - If the caller provides an email, resolve it via Supabase Auth Admin API instead (service role).
 *
 * Body:
 *   { "user": "<uuid | email | 'me' | 'self'>" }
 * If user is omitted/blank, defaults to the current authenticated admin user.
 */

const BodySchema = z.object({
  user: z.string().max(320).optional(),
});

const UUID_RE = /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function variantsToNames(variants: unknown): string[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((v) => String((v as any)?.name ?? "").trim())
    .filter(Boolean);
}

async function resolveUserIdByEmail(
  svc: any,
  emailNeedleRaw: string,
): Promise<string | null> {
  const emailNeedle = emailNeedleRaw.trim().toLowerCase();
  if (!emailNeedle.includes("@")) return null;

  // For most small/medium apps, paging through users is fine.
  // We cap pages to avoid unbounded loops.
  const PER_PAGE = 200;
  const MAX_PAGES = 20;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    const match = users.find((u: any) => String(u?.email ?? "").toLowerCase() === emailNeedle);
    if (match?.id) return match.id;

    // Stop early if we've reached the end.
    if (users.length < PER_PAGE) break;
  }

  return null;
}

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId: requesterId } = await requireAdmin(req);

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json(req, 400, { ok: false, code: "BAD_INPUT" });

    const needle = String(parsed.data.user ?? "").trim();

    // Default: "me" (current admin user)
    let userId = requesterId;
    if (needle && needle.toLowerCase() !== "me" && needle.toLowerCase() !== "self") {
      if (isUuid(needle)) {
        userId = needle;
      } else {
        // Treat as email (or reject)
        const byEmail = await resolveUserIdByEmail(svc, needle);
        if (!byEmail) {
          return json(req, 404, { ok: false, message: "User not found (provide UUID, exact email, or 'me')" });
        }
        userId = byEmail;
      }
    }

    const { data: experiments, error: expErr } = await svc
      .from("rec_experiments")
      .select("id,key,variants,status")
      .eq("status", "active")
      .order("key", { ascending: true });

    if (expErr) return json(req, 500, { ok: false, message: expErr.message });

    const expRows = experiments ?? [];
    if (!expRows.length) return json(req, 200, { ok: true, rows: [] });

    const experimentIds = expRows.map((row: any) => row.id);
    const { data: assignments, error: assignErr } = await svc
      .from("rec_user_experiment_assignments")
      .select("experiment_id,variant,assignment_mode")
      .eq("user_id", userId)
      .in("experiment_id", experimentIds);

    if (assignErr) return json(req, 500, { ok: false, message: assignErr.message });

    const assignmentMap = new Map(
      (assignments ?? []).map((row: any) => [row.experiment_id, row]),
    );

    // Auto-assign missing experiments (so the admin dashboard always has a deterministic row)
    for (const exp of expRows) {
      if (assignmentMap.has(exp.id)) continue;

      const { data: variant, error } = await svc.rpc("rec_assign_variant", {
        experiment_key: exp.key,
        user_id: userId,
      });

      if (!error && variant) {
        assignmentMap.set(exp.id, {
          experiment_id: exp.id,
          variant,
          assignment_mode: "auto",
        });
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
