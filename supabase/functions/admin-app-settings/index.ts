// supabase/functions/admin-app-settings/index.ts
//
// Admin (non-secret) app settings management.
//
// Security model:
// - verify_jwt = false (we validate the JWT manually)
// - requires Authorization: Bearer <user_jwt>
// - enforces admin membership via public.app_admins (checked with service_role)
// - writes are service_role only and audited

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

import { requireAdmin, handleCors, json, jsonError, HttpError } from "../_shared/admin.ts";
import { listAllSettings } from "../_shared/appSettings.ts";
import { APP_SETTINGS_REGISTRY, type KnownAppSettingKey, isKnownSettingKey, validateSettingValue } from "../_shared/appSettingsSchema.ts";

const FN_NAME = "admin-app-settings";

function makeRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

const UpdateBodySchema = z.object({
  action: z.literal("update"),
  expected_version: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
  updates: z.record(z.any()),
});

const HistoryBodySchema = z.object({
  action: z.literal("history"),
  key: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
  /** ISO timestamp lower-bound (inclusive) for changed_at. */
  since: z.string().optional(),
});

const ScopeEnum = z.enum(["public", "admin", "server_only"]);
type AppSettingScope = z.infer<typeof ScopeEnum>;

const ExportBodySchema = z.object({
  action: z.literal("export"),
  scopes: z.array(ScopeEnum).optional(),
  include_registry: z.boolean().optional().default(false),
});

const ImportBodySchema = z.object({
  action: z.literal("import"),
  mode: z.enum(["dry_run", "apply"]).optional().default("dry_run"),
  expected_version: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
  delete_missing: z.boolean().optional().default(false),
  scopes: z.array(ScopeEnum).optional(),
  bundle: z.any(),
});


const FavoritesGetBodySchema = z.object({
  action: z.literal("favorites_get"),
});

const FavoritesSetBodySchema = z.object({
  action: z.literal("favorites_set"),
  favorites: z.array(z.string()).max(500).optional().default([]),
});


const PresetsListBodySchema = z.object({
  action: z.literal("presets_list"),
});

const PresetPreviewBodySchema = z.object({
  action: z.literal("presets_preview"),
  slug: z.string().min(1).max(200),
});

const PresetApplyBodySchema = z.object({
  action: z.literal("presets_apply"),
  slug: z.string().min(1).max(200),
  expected_version: z.number().int().positive().optional(),
  reason: z.string().max(500),
});

type EditorMeta =
  | { kind: "number"; int?: boolean; min?: number; max?: number }
  | { kind: "string"; minLength?: number; maxLength?: number }
  | { kind: "boolean" }
  | { kind: "enum"; values: string[] }
  | { kind: "json" };

function unwrapZod(schema: any): any {
  let cur = schema;
  for (let i = 0; i < 8; i++) {
    const tn = cur?._def?.typeName;
    if (!tn) break;
    if (tn === "ZodDefault" || tn === "ZodOptional" || tn === "ZodNullable") {
      cur = cur?._def?.innerType;
      continue;
    }
    if (tn === "ZodEffects") {
      cur = cur?._def?.schema;
      continue;
    }
    break;
  }
  return cur;
}

function editorMetaFromSchema(schema: any): EditorMeta {
  const s = unwrapZod(schema);
  const tn = s?._def?.typeName;

  if (tn === "ZodNumber") {
    const checks = Array.isArray(s?._def?.checks) ? s._def.checks : [];
    let min: number | undefined;
    let max: number | undefined;
    let isInt = false;
    for (const c of checks) {
      if (c?.kind === "min") min = Number(c.value);
      if (c?.kind === "max") max = Number(c.value);
      if (c?.kind === "int") isInt = true;
    }
    return { kind: "number", int: isInt, min, max };
  }

  if (tn === "ZodString") {
    const checks = Array.isArray(s?._def?.checks) ? s._def.checks : [];
    let minLength: number | undefined;
    let maxLength: number | undefined;
    for (const c of checks) {
      if (c?.kind === "min") minLength = Number(c.value);
      if (c?.kind === "max") maxLength = Number(c.value);
    }
    return { kind: "string", minLength, maxLength };
  }

  if (tn === "ZodBoolean") return { kind: "boolean" };

  if (tn === "ZodEnum") {
    const values = Array.isArray(s?._def?.values) ? s._def.values : [];
    return { kind: "enum", values };
  }

  return { kind: "json" };
}

function parseSinceIso(since?: string): string | null {
  if (!since) return null;
  const d = new Date(since);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
      if (!deepEqual((a as any)[ak[i]], (b as any)[bk[i]])) return false;
    }
    return true;
  }
  return false;
}

type SettingsBundleV1 = {
  format: "movinesta_app_settings_bundle_v1";
  exported_at: string;
  version: number;
  scopes: AppSettingScope[];
  settings: Record<string, unknown>;
};

function normalizeImportBundle(raw: unknown): { settings: Record<string, unknown>; scopes?: AppSettingScope[] } {
  // Allow either:
  // 1) { format, scopes, settings }
  // 2) { settings: {...} }
  // 3) { "key": value, ... }
  if (isPlainObject(raw)) {
    const maybeSettings = (raw as any).settings;
    if (isPlainObject(maybeSettings)) {
      const scopes = Array.isArray((raw as any).scopes) ? (raw as any).scopes : undefined;
      return { settings: maybeSettings as any, scopes };
    }
    return { settings: raw as any };
  }
  return { settings: {} };
}


function uniqStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

type FavoritesStorage = "db" | "fallback";
type FavoritesReadResult = { favorites: string[]; storage: FavoritesStorage };

function isMissingRelationError(err: any, relation: string): boolean {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  if (code === "42P01") return true; // undefined_table
  const m = msg.toLowerCase();
  return m.includes("does not exist") && m.includes(relation.toLowerCase());
}

async function readFavorites(svc: any, userId: string): Promise<FavoritesReadResult> {
  const { data, error } = await svc
    .from("admin_user_prefs")
    .select("settings_favorites")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Graceful fallback when migration isn't applied yet (table missing) or any other error.
    return { favorites: [], storage: "fallback" };
  }

  const favs = (data as any)?.settings_favorites;
  const favorites = Array.isArray(favs) ? favs.filter((x: any) => typeof x === "string") : [];
  return { favorites, storage: "db" };
}

async function writeFavorites(
  svc: any,
  userId: string,
  favorites: string[],
  updatedBy: string,
  requestId: string,
): Promise<{ favorites: string[]; storage: FavoritesStorage }> {
  const clean = uniqStrings(
    favorites
      .map((k) => String(k))
      .filter((k) => (APP_SETTINGS_REGISTRY as any)[k]),
  );

  const { error } = await svc
    .from("admin_user_prefs")
    .upsert({ user_id: userId, settings_favorites: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    if (isMissingRelationError(error, "admin_user_prefs")) {
      // Migration not applied yet -> do not throw; UI will continue using localStorage fallback.
      return { favorites: clean, storage: "fallback" };
    }
    throw new HttpError(500, error.message);
  }

  const { error: auditErr } = await svc.from("admin_audit_log").insert({
    admin_user_id: updatedBy,
    action: "admin_settings_favorites_set",
    target: "admin_user_prefs",
    details: { request_id: requestId, favorites_count: clean.length },
  });
  if (auditErr) throw new HttpError(500, auditErr.message);

  return { favorites: clean, storage: "db" };
}


type PresetsStorage = "db" | "fallback";

type AppSettingsPresetRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  group_key: string;
  preset: Record<string, unknown>;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

function validateUpdatesSafe(updates: Record<string, unknown>): {
  valid: Record<KnownAppSettingKey, unknown>;
  unknownKeys: string[];
  invalidValues: Array<{ key: string; message: string }>;
} {
  const valid: Record<string, unknown> = {};
  const unknownKeys: string[] = [];
  const invalidValues: Array<{ key: string; message: string }> = [];

  for (const [rawKey, rawValue] of Object.entries(updates ?? {})) {
    const key = String(rawKey);
    if (!isKnownSettingKey(key)) {
      unknownKeys.push(key);
      continue;
    }
    try {
      valid[key] = validateSettingValue(key, rawValue);
    } catch (e) {
      invalidValues.push({ key, message: (e as any)?.message ?? "Invalid value" });
    }
  }

  return { valid: valid as any, unknownKeys, invalidValues };
}

function normalizePresetJson(preset: any): Record<string, unknown> {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) return {};
  return preset as Record<string, unknown>;
}

async function listPresets(svc: any): Promise<{ presets: AppSettingsPresetRow[]; storage: PresetsStorage }> {
  const { data, error } = await svc
    .from("app_settings_presets")
    .select("id, slug, title, description, group_key, preset, is_builtin, created_at, updated_at")
    .order("group_key", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    if (isMissingRelationError(error, "app_settings_presets")) {
      return { presets: [], storage: "fallback" };
    }
    throw new HttpError(500, error.message);
  }

  return { presets: (data ?? []) as any, storage: "db" };
}

async function getPresetBySlug(
  svc: any,
  slug: string,
): Promise<{ preset: AppSettingsPresetRow | null; storage: PresetsStorage }> {
  const { data, error } = await svc
    .from("app_settings_presets")
    .select("id, slug, title, description, group_key, preset, is_builtin, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "app_settings_presets")) {
      return { preset: null, storage: "fallback" };
    }
    throw new HttpError(500, error.message);
  }

  return { preset: (data as any) ?? null, storage: "db" };
}


export async function handler(req: Request): Promise<Response> {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { svc, userId, email, role } = await requireAdmin(req);

    const rawBody = await req.json().catch(() => ({}));
    const action = String((rawBody as any)?.action ?? "get");

    if (action === "get") {
      const { version, rows } = await listAllSettings(svc as any);
      // Only return JSON-serializable registry metadata (never return Zod schemas).
      const registry = Object.fromEntries(
        Object.entries(APP_SETTINGS_REGISTRY).map(([k, e]) => [
          k,
          {
            scope: (e as any).scope,
            default: (e as any).default,
            description: (e as any).description,
            // Optional editor metadata derived from Zod schema (min/max, type, enum values).
            // This is non-secret and helps Admin UI render safe, schema-driven editors.
            meta: editorMetaFromSchema((e as any).schema),
          },
        ]),
      );

      const fav = await readFavorites(svc as any, userId);

      return json(req, 200, { ok: true, version, rows, registry, favorites: fav.favorites, favorites_storage: fav.storage, actor: { userId, email, role } }, {
        "x-function": FN_NAME,
      });
    }


    if (action === "favorites_get") {
        FavoritesGetBodySchema.parse(rawBody);
        const fav = await readFavorites(svc as any, userId);
        return json(req, 200, { ok: true, favorites: fav.favorites, favorites_storage: fav.storage, actor: { userId, email, role } }, { "x-function": FN_NAME });
    }

    if (action === "favorites_set") {
        const body = FavoritesSetBodySchema.parse(rawBody);
        const requestId = makeRequestId();
        const fav = await writeFavorites(svc as any, userId, body.favorites ?? [], userId, requestId);
        return json(req, 200, { ok: true, favorites: fav.favorites, favorites_storage: fav.storage, actor: { userId, email, role }, request_id: requestId }, { "x-function": FN_NAME, "x-request-id": requestId });
    }


    if (action === "presets_list") {
      PresetsListBodySchema.parse(rawBody);
      const res = await listPresets(svc as any);
      return json(req, 200, { ok: true, presets: res.presets, presets_storage: res.storage, actor: { userId, email, role } }, { "x-function": FN_NAME });
    }

    if (action === "presets_preview") {
      const body = PresetPreviewBodySchema.parse(rawBody);
      const slug = body.slug.trim();

      const presetRes = await getPresetBySlug(svc as any, slug);

      if (presetRes.storage === "fallback") {
        return json(req, 200, {
          ok: true,
          presets_storage: "fallback",
          preset: null,
          preview: null,
          message: "Presets table not available (migration not applied yet)",
          actor: { userId, email, role },
        }, { "x-function": FN_NAME });
      }

      if (!presetRes.preset) {
        return json(req, 404, { ok: false, code: "PRESET_NOT_FOUND", message: "Preset not found" }, { "x-function": FN_NAME });
      }

      const presetObj = normalizePresetJson((presetRes.preset as any).preset);

      const { version, rows } = await listAllSettings(svc as any);

      const existingByKey = new Map<string, any>();
      for (const row of (rows ?? []) as any[]) {
        const key = String(row?.key ?? "");
        if (key) existingByKey.set(key, row);
      }

      const { valid, unknownKeys, invalidValues } = validateUpdatesSafe(presetObj);

      const counts = {
        update: 0,
        reset: 0,
        same: 0,
        already_default: 0,
        unknown: unknownKeys.length,
        invalid: invalidValues.length,
      };

      const changes: Array<{
        key: string;
        scope: string;
        change_type: "update" | "reset" | "same" | "already_default";
        current: unknown;
        target: unknown;
        had_override: boolean;
      }> = [];

      const keys = Object.keys(valid).sort() as KnownAppSettingKey[];

      for (const key of keys) {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        if (!entry) continue;

        const prev = existingByKey.get(key);
        const currentEffective = prev ? prev.value : (entry as any).default;
        const incoming = (valid as any)[key];

        const targetIsDefault = deepEqual(incoming, (entry as any).default);

        let change_type: "update" | "reset" | "same" | "already_default" = "update";

        if (targetIsDefault) {
          if (prev) {
            change_type = "reset";
            counts.reset++;
          } else {
            change_type = "already_default";
            counts.already_default++;
          }
        } else {
          if (deepEqual(currentEffective, incoming)) {
            change_type = "same";
            counts.same++;
          } else {
            change_type = "update";
            counts.update++;
          }
        }

        changes.push({
          key,
          scope: String(entry.scope),
          change_type,
          current: currentEffective,
          target: incoming,
          had_override: !!prev,
        });
      }

      return json(req, 200, {
        ok: true,
        presets_storage: "db",
        preset: presetRes.preset,
        version,
        preview: {
          counts,
          changes,
          unknown_keys: unknownKeys.sort(),
          invalid_values: invalidValues,
        },
        actor: { userId, email, role },
      }, { "x-function": FN_NAME });
    }

    if (action === "presets_apply") {
      const body = PresetApplyBodySchema.parse(rawBody);
      const slug = body.slug.trim();
      const reason = (body.reason ?? "").trim();
      if (!reason) {
        return json(req, 400, { ok: false, code: "REASON_REQUIRED", message: "Preset apply requires a reason" }, { "x-function": FN_NAME });
      }

      const presetRes = await getPresetBySlug(svc as any, slug);

      if (presetRes.storage === "fallback") {
        return json(req, 409, { ok: false, code: "PRESETS_NOT_AVAILABLE", message: "Presets are not available until the migration is applied" }, { "x-function": FN_NAME });
      }

      if (!presetRes.preset) {
        return json(req, 404, { ok: false, code: "PRESET_NOT_FOUND", message: "Preset not found" }, { "x-function": FN_NAME });
      }

      // Optimistic concurrency on meta version.
      const { data: metaRow, error: metaErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (metaErr) throw new HttpError(500, metaErr.message);
      const currentVersion = Number((metaRow as any)?.version ?? 1) || 1;
      if (body.expected_version && body.expected_version !== currentVersion) {
        return json(req, 409, {
          ok: false,
          message: "Settings have changed; refresh and try again",
          code: "VERSION_MISMATCH",
          current_version: currentVersion,
        });
      }

      const presetObj = normalizePresetJson((presetRes.preset as any).preset);
      const { valid, unknownKeys, invalidValues } = validateUpdatesSafe(presetObj);

      if (invalidValues.length) {
        return json(req, 400, { ok: false, code: "INVALID_SETTING_VALUES", message: "One or more preset values failed validation", invalidValues }, { "x-function": FN_NAME });
      }

      const keys = Object.keys(valid) as KnownAppSettingKey[];
      if (!keys.length) {
        return json(req, 400, { ok: false, code: "NO_UPDATES", message: "Preset contained no registered settings" }, { "x-function": FN_NAME });
      }

      // Load existing rows for versioning + history.
      const { data: existingRows, error: existingErr } = await svc
        .from("app_settings")
        .select("key, value, version, scope")
        .in("key", keys as any);

      if (existingErr) throw new HttpError(500, existingErr.message);

      const existingByKey = new Map<string, any>();
      for (const row of (existingRows ?? []) as any[]) {
        if (row?.key) existingByKey.set(String(row.key), row);
      }

      const nowIso = new Date().toISOString();
      const requestId = (req.headers.get("x-request-id") ?? "").trim() || makeRequestId();

      const updated_keys: string[] = [];
      const deleted_keys: string[] = [];
      const same_keys: string[] = [];
      const ignored_default_keys: string[] = [];

      const upsertRows: any[] = [];
      const deleteKeys: string[] = [];
      const historyRows: any[] = [];

      const changeReason = `Preset: ${slug} — ${reason}`;

      for (const key of keys) {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        if (!entry) continue;

        const incoming = (valid as any)[key];
        const prev = existingByKey.get(key);

        // If incoming equals registry default, treat as "reset to default": delete override row.
        const isDefault = deepEqual(incoming, (entry as any).default);
        if (isDefault) {
          if (prev) {
            deleteKeys.push(key);
            deleted_keys.push(key);
            historyRows.push({
              key,
              scope: entry.scope,
              old_value: prev ? prev.value : null,
              new_value: null,
              old_version: prev ? Number(prev?.version ?? null) : null,
              new_version: null,
              change_reason: changeReason,
              request_id: requestId,
              changed_by: userId,
            });
          } else {
            ignored_default_keys.push(key);
          }
          continue;
        }

        // No-op if same value as stored.
        if (prev && deepEqual(prev.value, incoming)) {
          same_keys.push(key);
          continue;
        }

        const prevVersion = Number(prev?.version ?? 0) || 0;
        const nextVersion = prevVersion + 1;
        upsertRows.push({
          key,
          scope: entry.scope,
          value: incoming,
          description: entry.description,
          version: nextVersion,
          updated_at: nowIso,
          updated_by: userId,
        });
        updated_keys.push(key);
        historyRows.push({
          key,
          scope: entry.scope,
          old_value: prev ? prev.value : null,
          new_value: incoming,
          old_version: prev ? Number(prev?.version ?? null) : null,
          new_version: nextVersion,
          change_reason: changeReason,
          request_id: requestId,
          changed_by: userId,
        });
      }

      if (!upsertRows.length && !deleteKeys.length) {
        return json(req, 200, {
          ok: true,
          version: currentVersion,
          preset_slug: slug,
          updated_keys,
          deleted_keys,
          same_keys,
          ignored_default_keys,
          ignored_unknown_keys: unknownKeys.sort(),
          request_id: requestId,
        }, { "x-request-id": requestId, "x-function": FN_NAME });
      }

      if (upsertRows.length) {
        const { error: upsertErr } = await svc
          .from("app_settings")
          .upsert(upsertRows, { onConflict: "key" });
        if (upsertErr) throw new HttpError(500, upsertErr.message);
      }

      if (deleteKeys.length) {
        const { error: delErr } = await svc
          .from("app_settings")
          .delete()
          .in("key", deleteKeys as any);
        if (delErr) throw new HttpError(500, delErr.message);
      }

      if (historyRows.length) {
        const { error: histErr } = await svc.from("app_settings_history").insert(historyRows);
        if (histErr) {
          await svc.from("admin_audit_log").insert({
            admin_user_id: userId,
            action: "app_settings_history_insert_failed",
            target: "app_settings_history",
            details: { error: histErr.message, updated_keys, deleted_keys, preset_slug: slug },
          });
        }
      }

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "app_settings_preset_apply",
        target: "app_settings",
        details: {
          preset_slug: slug,
          reason,
          request_id: requestId,
          updated_keys,
          deleted_keys,
          same_keys,
          ignored_default_keys,
          ignored_unknown_keys: unknownKeys.sort(),
        },
      });

      const { data: metaAfter, error: metaAfterErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();

      if (metaAfterErr) throw new HttpError(500, metaAfterErr.message);
      const newMetaVersion = Number((metaAfter as any)?.version ?? currentVersion) || currentVersion;

      return json(req, 200, {
        ok: true,
        version: newMetaVersion,
        preset_slug: slug,
        updated_keys,
        deleted_keys,
        same_keys,
        ignored_default_keys,
        ignored_unknown_keys: unknownKeys.sort(),
        request_id: requestId,
      }, { "x-request-id": requestId, "x-function": FN_NAME });
    }


    if (action === "export") {
      const body = ExportBodySchema.parse(rawBody);
      const requestedScopes = body.scopes && body.scopes.length ? body.scopes : (["public", "admin", "server_only"] as AppSettingScope[]);

      const { version, rows } = await listAllSettings(svc as any);

      const settings: Record<string, unknown> = {};
      const skipped_unregistered: string[] = [];

      for (const r of rows as any[]) {
        const key = String(r?.key ?? "");
        const scope = String(r?.scope ?? "") as AppSettingScope;
        if (!requestedScopes.includes(scope)) continue;
        if (!(key in (APP_SETTINGS_REGISTRY as any))) {
          skipped_unregistered.push(key);
          continue;
        }
        settings[key] = r?.value;
      }

      const bundle: SettingsBundleV1 = {
        format: "movinesta_app_settings_bundle_v1",
        exported_at: new Date().toISOString(),
        version,
        scopes: requestedScopes,
        settings,
      };

      const resp: any = { ok: true, bundle, skipped_unregistered };
      if (body.include_registry) {
        resp.registry = Object.fromEntries(
          Object.entries(APP_SETTINGS_REGISTRY).map(([k, e]) => [
            k,
            { scope: (e as any).scope, default: (e as any).default, description: (e as any).description },
          ]),
        );
      }

      return json(req, 200, resp, { "x-function": FN_NAME });
    }

    if (action === "import") {
      const body = ImportBodySchema.parse(rawBody);

      const normalized = normalizeImportBundle(body.bundle);
      const incoming = normalized.settings ?? {};

      const requestedScopes = (body.scopes && body.scopes.length
        ? body.scopes
        : (normalized.scopes && normalized.scopes.length ? normalized.scopes : null))
        ?? (["public", "admin", "server_only"] as AppSettingScope[]);

      // Filter keys by registry + requested scopes.
      const scopedIncoming: Record<string, unknown> = {};
      const skipped_scope: string[] = [];
      const skipped_unknown: string[] = [];

      for (const [k, v] of Object.entries(incoming)) {
        const key = String(k);
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        if (!entry) {
          skipped_unknown.push(key);
          continue;
        }
        const scope = String(entry.scope) as AppSettingScope;
        if (!requestedScopes.includes(scope)) {
          skipped_scope.push(key);
          continue;
        }
        scopedIncoming[key] = v;
      }

      // Validate incoming values.
      const { valid: validIncoming, unknownKeys, invalidValues } = validateUpdatesSafe(scopedIncoming);
      if (unknownKeys.length) {
        return json(req, 400, {
          ok: false,
          code: "UNKNOWN_SETTING_KEYS",
          message: "One or more setting keys are not registered",
          invalidKeys: unknownKeys,
        }, { "x-function": FN_NAME });
      }
      if (invalidValues.length) {
        return json(req, 400, {
          ok: false,
          code: "INVALID_SETTING_VALUES",
          message: "One or more values failed validation",
          invalidValues,
        }, { "x-function": FN_NAME });
      }
      const valid: Record<string, unknown> = validIncoming as any;

            const { version, rows } = await listAllSettings(svc as any);
      const existingByKey = new Map<string, any>();
      for (const r of rows as any[]) {
        if (!r?.key) continue;
        const key = String(r.key);
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        if (!entry) continue;
        const scope = String(entry.scope) as AppSettingScope;
        if (!requestedScopes.includes(scope)) continue;
        existingByKey.set(key, r);
      }

      const adds: string[] = [];
      const updates: string[] = [];
      const same: string[] = [];

      for (const [key, val] of Object.entries(valid)) {
        const prev = existingByKey.get(key);
        if (!prev) {
          adds.push(key);
          continue;
        }
        if (deepEqual(prev.value, val)) same.push(key);
        else updates.push(key);
      }

      const deletes: string[] = [];
      if (body.delete_missing) {
        for (const [key] of existingByKey) {
          if (!(key in valid)) deletes.push(key);
        }
      }

      const preview = {
        requestedScopes,
        counts: {
          add: adds.length,
          update: updates.length,
          same: same.length,
          delete: deletes.length,
          skipped_scope: skipped_scope.length,
          skipped_unknown: skipped_unknown.length,
        },
        adds: adds.sort(),
        updates: updates.sort(),
        deletes: deletes.sort(),
        skipped_scope: skipped_scope.sort(),
        skipped_unknown: skipped_unknown.sort(),
        version,
      };

      if (body.mode === "dry_run") {
        return json(req, 200, { ok: true, preview, actor: { userId, email, role } }, { "x-function": FN_NAME });
      }

      // APPLY
      const reason = (body.reason ?? "").trim();
      if (!reason) {
        return json(req, 400, { ok: false, code: "REASON_REQUIRED", message: "Import apply requires a reason" }, { "x-function": FN_NAME });
      }

      // optimistic concurrency
      const { data: metaRow, error: metaErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (metaErr) throw new HttpError(500, metaErr.message);
      const currentVersion = Number((metaRow as any)?.version ?? 1) || 1;
      if (body.expected_version && body.expected_version !== currentVersion) {
        return json(req, 409, {
          ok: false,
          message: "Settings have changed; refresh and try again",
          code: "VERSION_MISMATCH",
          current_version: currentVersion,
        });
      }

      const nowIso = new Date().toISOString();
      const requestId = (req.headers.get("x-request-id") ?? "").trim() || makeRequestId();

      const applyKeys = [...adds, ...updates] as KnownAppSettingKey[];
      const upsertRows = applyKeys.map((key) => {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        const prev = existingByKey.get(key);
        const prevVersion = Number(prev?.version ?? 0) || 0;
        const nextVersion = prevVersion + 1;
        return {
          key,
          scope: entry.scope,
          value: (valid as any)[key],
          description: entry.description,
          version: nextVersion,
          updated_at: nowIso,
          updated_by: userId,
        };
      });

      if (upsertRows.length) {
        const { error: upsertErr } = await svc
          .from("app_settings")
          .upsert(upsertRows, { onConflict: "key" });
        if (upsertErr) throw new HttpError(500, upsertErr.message);
      }

      if (deletes.length) {
        const { error: delErr } = await svc
          .from("app_settings")
          .delete()
          .in("key", deletes as any);
        if (delErr) throw new HttpError(500, delErr.message);
      }

      // History rows
      const historyRows: any[] = [];
      for (const key of applyKeys) {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        const prev = existingByKey.get(key);
        const oldVersion = prev ? Number(prev?.version ?? null) : null;
        const newVersion = (upsertRows.find((r) => r.key === key) as any)?.version ?? null;
        historyRows.push({
          key,
          scope: entry.scope,
          old_value: prev ? prev.value : null,
          new_value: (valid as any)[key],
          old_version: oldVersion,
          new_version: newVersion,
          change_reason: `Import: ${reason}`,
          request_id: requestId,
          changed_by: userId,
        });
      }

      for (const key of deletes) {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        const prev = existingByKey.get(key);
        historyRows.push({
          key,
          scope: entry.scope,
          old_value: prev ? prev.value : null,
          new_value: null,
          old_version: prev ? Number(prev?.version ?? null) : null,
          new_version: null,
          change_reason: `Import delete: ${reason}`,
          request_id: requestId,
          changed_by: userId,
        });
      }

      if (historyRows.length) {
        const { error: histErr } = await svc.from("app_settings_history").insert(historyRows);
        if (histErr) {
          await svc.from("admin_audit_log").insert({
            admin_user_id: userId,
            action: "app_settings_history_insert_failed",
            target: "app_settings_history",
            details: { error: histErr.message, applyKeys, deletes },
          });
        }
      }

      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "app_settings_import",
        target: "app_settings",
        details: {
          reason,
          request_id: requestId,
          applied: { add: adds.length, update: updates.length, delete: deletes.length },
          scopes: requestedScopes,
        },
      });

      const { data: metaAfter, error: metaAfterErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (metaAfterErr) throw new HttpError(500, metaAfterErr.message);
      const newMetaVersion = Number((metaAfter as any)?.version ?? currentVersion) || currentVersion;

      return json(req, 200, {
        ok: true,
        preview,
        version: newMetaVersion,
        request_id: requestId,
      }, { "x-function": FN_NAME, "x-request-id": requestId });
    }

    if (action === "history") {
      const body = HistoryBodySchema.parse(rawBody);
      const sinceIso = parseSinceIso(body.since);
      const q = svc
        .from("app_settings_history")
        .select("id, key, scope, old_value, new_value, old_version, new_version, change_reason, request_id, changed_at, changed_by")
        .order("changed_at", { ascending: false })
        .limit(body.limit);

      let query: any = q;
      if (body.key) query = query.eq("key", body.key);
      if (sinceIso) query = query.gte("changed_at", sinceIso);
      const { data, error } = await query;
      if (error) throw new HttpError(500, error.message);

      return json(req, 200, { ok: true, rows: data ?? [], actor: { userId, email, role } }, { "x-function": FN_NAME });
    }

    if (action === "update") {
      const body = UpdateBodySchema.parse(rawBody);

      // Optimistic concurrency on meta version.
      const { data: metaRow, error: metaErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();
      if (metaErr) throw new HttpError(500, metaErr.message);
      const currentVersion = Number((metaRow as any)?.version ?? 1) || 1;
      if (body.expected_version && body.expected_version !== currentVersion) {
        return json(req, 409, {
          ok: false,
          message: "Settings have changed; refresh and try again",
          code: "VERSION_MISMATCH",
          current_version: currentVersion,
        });
      }

      const { valid, unknownKeys, invalidValues } = validateUpdatesSafe(body.updates ?? {});
      if (unknownKeys.length) {
        return json(req, 400, {
          ok: false,
          code: "UNKNOWN_SETTING_KEYS",
          message: "One or more setting keys are not registered",
          invalidKeys: unknownKeys,
        });
      }
      if (invalidValues.length) {
        return json(req, 400, {
          ok: false,
          code: "INVALID_SETTING_VALUES",
          message: "One or more values failed validation",
          invalidValues,
        });
      }

      const keys = Object.keys(valid) as KnownAppSettingKey[];
      if (!keys.length) {
        return json(req, 400, { ok: false, code: "NO_UPDATES", message: "No updates provided" });
      }

      // Load existing rows for versioning + history.
      const { data: existingRows, error: existingErr } = await svc
        .from("app_settings")
        .select("key, value, version, scope")
        .in("key", keys as any);

      if (existingErr) throw new HttpError(500, existingErr.message);

      const existingByKey = new Map<string, any>();
      for (const row of (existingRows ?? []) as any[]) {
        if (row?.key) existingByKey.set(String(row.key), row);
      }

      const nowIso = new Date().toISOString();
      const requestId = (req.headers.get("x-request-id") ?? "").trim() || makeRequestId();

      const updated_keys: string[] = [];
      const deleted_keys: string[] = [];
      const same_keys: string[] = [];
      const ignored_default_keys: string[] = [];

      const upsertRows: any[] = [];
      const deleteKeys: string[] = [];
      const historyRows: any[] = [];

      for (const key of keys) {
        const entry = (APP_SETTINGS_REGISTRY as any)[key];
        if (!entry) continue;

        const incoming = (valid as any)[key];
        const prev = existingByKey.get(key);

        // If incoming equals registry default, treat as "reset to default": delete override row.
        const isDefault = deepEqual(incoming, (entry as any).default);
        if (isDefault) {
          if (prev) {
            deleteKeys.push(key);
            deleted_keys.push(key);
            historyRows.push({
              key,
              scope: entry.scope,
              old_value: prev ? prev.value : null,
              new_value: null,
              old_version: prev ? Number(prev?.version ?? null) : null,
              new_version: null,
              change_reason: body.reason ?? null,
              request_id: requestId,
              changed_by: userId,
            });
          } else {
            // Already default; nothing to delete.
            ignored_default_keys.push(key);
          }
          continue;
        }

        // No-op if same value as stored.
        if (prev && deepEqual(prev.value, incoming)) {
          same_keys.push(key);
          continue;
        }

        // Upsert change.
        const prevVersion = Number(prev?.version ?? 0) || 0;
        const nextVersion = prevVersion + 1;
        upsertRows.push({
          key,
          scope: entry.scope,
          value: incoming,
          description: entry.description,
          version: nextVersion,
          updated_at: nowIso,
          updated_by: userId,
        });
        updated_keys.push(key);
        historyRows.push({
          key,
          scope: entry.scope,
          old_value: prev ? prev.value : null,
          new_value: incoming,
          old_version: prev ? Number(prev?.version ?? null) : null,
          new_version: nextVersion,
          change_reason: body.reason ?? null,
          request_id: requestId,
          changed_by: userId,
        });
      }

      // If nothing changed, return success without bumping version.
      if (!upsertRows.length && !deleteKeys.length) {
        return json(
          req,
          200,
          {
            ok: true,
            version: currentVersion,
            updated_keys,
            deleted_keys,
            same_keys,
            ignored_default_keys,
          },
          {
            "x-request-id": requestId,
            "x-function": FN_NAME,
          },
        );
      }

      if (upsertRows.length) {
        const { error: upsertErr } = await svc
          .from("app_settings")
          .upsert(upsertRows, { onConflict: "key" });
        if (upsertErr) throw new HttpError(500, upsertErr.message);
      }

      if (deleteKeys.length) {
        const { error: delErr } = await svc
          .from("app_settings")
          .delete()
          .in("key", deleteKeys as any);
        if (delErr) throw new HttpError(500, delErr.message);
      }

      // History rows (write-only table)
      if (historyRows.length) {
        const { error: histErr } = await svc.from("app_settings_history").insert(historyRows);
        if (histErr) {
          // Non-fatal, but we should know.
          // Keep behavior safe: settings update already happened.
          await svc.from("admin_audit_log").insert({
            admin_user_id: userId,
            action: "app_settings_history_insert_failed",
            target: "app_settings_history",
            details: { error: histErr.message, updated_keys, deleted_keys },
          });
        }
      }

      // Admin audit log
      await svc.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "app_settings_update",
        target: "app_settings",
        details: {
          updated_keys,
          deleted_keys,
          same_keys,
          ignored_default_keys,
          reason: body.reason ?? null,
          request_id: requestId,
        },
      });

      const { data: metaAfter, error: metaAfterErr } = await svc
        .from("app_settings_meta")
        .select("version")
        .eq("id", 1)
        .maybeSingle();

      if (metaAfterErr) throw new HttpError(500, metaAfterErr.message);
      const newMetaVersion = Number((metaAfter as any)?.version ?? currentVersion) || currentVersion;

      return json(
        req,
        200,
        {
          ok: true,
          version: newMetaVersion,
          updated_keys,
          deleted_keys,
          same_keys,
          ignored_default_keys,
        },
        {
          "x-request-id": requestId,
          "x-function": FN_NAME,
        },
      );
    }

    return json(req, 400, { ok: false, message: `Unknown action: ${action}` }, { "x-function": FN_NAME });
  } catch (e) {
    return jsonError(req, e);
  }
}

serve(handler);
