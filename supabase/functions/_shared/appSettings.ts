// supabase/functions/_shared/appSettings.ts
//
// Helpers to load, validate, and cache non-secret app settings.
//
// NOTE:
// - Validation is enforced via the registry in appSettingsSchema.ts.
// - Defaults are always applied so missing DB rows never break behavior.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import {
  getDefaultPublicSettings,
  getDefaultSettingsForScope,
  isKnownSettingKey,
  validateSettingValue,
  type AppSettingScope,
  type KnownAppSettingKey,
  APP_SETTINGS_REGISTRY,
} from "./appSettingsSchema.ts";

export type PublicAppSettingsEnvelope = {
  ok: true;
  version: number;
  settings: Record<string, unknown>;
};

type CacheEntry = {
  atMs: number;
  version: number;
  settings: Record<string, unknown>;
};

let publicCache: CacheEntry | null = null;

async function fetchMetaVersion(client: SupabaseClient): Promise<number> {
  const { data, error } = await client
    .from("app_settings_meta")
    .select("version")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const v = (data as any)?.version;
  return typeof v === "number" ? v : Number(v ?? 1) || 1;
}

export async function loadPublicAppSettings(
  client: SupabaseClient,
  opts?: { cacheTtlMs?: number },
): Promise<PublicAppSettingsEnvelope> {
  const cacheTtlMs = opts?.cacheTtlMs ?? 30_000;

  // Cache is keyed by meta version (bumped by trigger) to avoid unnecessary DB reads.
  if (publicCache && Date.now() - publicCache.atMs <= cacheTtlMs) {
    return { ok: true, version: publicCache.version, settings: { ...publicCache.settings } };
  }

  const version = await fetchMetaVersion(client);

  // If the meta version hasn't changed, we can still reuse cache even if TTL expired.
  if (publicCache && publicCache.version === version) {
    publicCache = { ...publicCache, atMs: Date.now() };
    return { ok: true, version, settings: { ...publicCache.settings } };
  }

  const defaults = getDefaultPublicSettings();

  const { data, error } = await client
    .from("app_settings")
    .select("key, value, scope")
    .eq("scope", "public");

  if (error) throw new Error(error.message);

  const settings: Record<string, unknown> = { ...defaults };

  for (const row of (data ?? []) as any[]) {
    const key = String(row.key ?? "");
    if (!isKnownSettingKey(key)) continue;

    // Defensive: never trust DB content.
    try {
      settings[key] = validateSettingValue(key, row.value);
    } catch {
      // If validation fails, fall back to default.
      settings[key] = (APP_SETTINGS_REGISTRY as any)[key].default;
    }
  }

  publicCache = { atMs: Date.now(), version, settings };

  return { ok: true, version, settings: { ...settings } };
}


export type AppSettingsEnvelope = {
  ok: true;
  version: number;
  settings: Record<string, unknown>;
};

let scopedCache = new Map<string, CacheEntry>();

function scopesKey(scopes: AppSettingScope[]): string {
  return [...scopes].sort().join(",");
}

/**
 * Load settings for one or more scopes (admin/server_only), applying defaults and validating DB values.
 *
 * Typical use:
 * - Edge Functions: loadAppSettingsForScopes(adminClient, ["server_only"])
 * - Admin dashboards: listAllSettings() (no caching, full rows)
 */
export async function loadAppSettingsForScopes(
  client: SupabaseClient,
  scopes: AppSettingScope[],
  opts?: { cacheTtlMs?: number },
): Promise<AppSettingsEnvelope> {
  const normalizedScopes = (scopes ?? []).filter(Boolean);
  if (!normalizedScopes.length) {
    return { ok: true, version: 1, settings: {} };
  }

  const cacheTtlMs = opts?.cacheTtlMs ?? 30_000;
  const cacheKey = scopesKey(normalizedScopes);

  const cached = scopedCache.get(cacheKey);
  if (cached && Date.now() - cached.atMs <= cacheTtlMs) {
    return { ok: true, version: cached.version, settings: { ...cached.settings } };
  }

  const version = await fetchMetaVersion(client);

  // If the meta version hasn't changed, we can still reuse cache even if TTL expired.
  if (cached && cached.version === version) {
    const refreshed = { ...cached, atMs: Date.now() };
    scopedCache.set(cacheKey, refreshed);
    return { ok: true, version, settings: { ...refreshed.settings } };
  }

  // Merge defaults for requested scopes.
  const defaults: Record<string, unknown> = {};
  for (const scope of normalizedScopes) {
    Object.assign(defaults, getDefaultSettingsForScope(scope));
  }

  const { data, error } = await client
    .from("app_settings")
    .select("key, value, scope")
    .in("scope", normalizedScopes as any);

  if (error) throw new Error(error.message);

  const settings: Record<string, unknown> = { ...defaults };

  for (const row of (data ?? []) as any[]) {
    const key = String(row.key ?? "");
    if (!isKnownSettingKey(key)) continue;

    // Defensive: never trust DB content; enforce registry validation.
    try {
      settings[key] = validateSettingValue(key, row.value);
    } catch {
      settings[key] = (APP_SETTINGS_REGISTRY as any)[key].default;
    }
  }

  scopedCache.set(cacheKey, { atMs: Date.now(), version, settings });

  return { ok: true, version, settings: { ...settings } };
}

export type AppSettingsRow = {
  key: string;
  scope: AppSettingScope;
  value: unknown;
  description: string | null;
  version: number;
  updated_at: string;
  updated_by: string | null;
};

export async function listAllSettings(client: SupabaseClient): Promise<{ version: number; rows: AppSettingsRow[] }> {
  const version = await fetchMetaVersion(client);
  const { data, error } = await client
    .from("app_settings")
    .select("key, scope, value, description, version, updated_at, updated_by")
    .order("key", { ascending: true });

  if (error) throw new Error(error.message);

  return { version, rows: (data ?? []) as any };
}

export function validateUpdates(updates: Record<string, unknown>): {
  valid: Record<KnownAppSettingKey, unknown>;
  invalidKeys: string[];
} {
  const valid: Record<string, unknown> = {};
  const invalidKeys: string[] = [];

  for (const [rawKey, rawValue] of Object.entries(updates ?? {})) {
    const key = String(rawKey);
    if (!isKnownSettingKey(key)) {
      invalidKeys.push(key);
      continue;
    }

    valid[key] = validateSettingValue(key, rawValue);
  }

  return { valid: valid as any, invalidKeys };
}
