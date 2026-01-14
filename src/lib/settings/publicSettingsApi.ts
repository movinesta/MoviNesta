// src/lib/settings/publicSettingsApi.ts
//
// Client-side loader for public (non-secret) app settings.

import { callSupabaseFunction } from "@/lib/callSupabaseFunction";
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettingKey } from "./defaultPublicSettings";

export type PublicSettingsEnvelope = {
  ok: true;
  version: number;
  settings: Record<string, unknown>;
};

export type LoadedPublicSettings = {
  version: number;
  settings: Record<string, unknown>;
};

export function mergePublicSettings(
  remote: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...DEFAULT_PUBLIC_SETTINGS };
  if (!remote) return merged;
  for (const [k, v] of Object.entries(remote)) {
    merged[k] = v;
  }
  return merged;
}

export async function fetchPublicSettings(opts?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<LoadedPublicSettings> {
  const data = await callSupabaseFunction<PublicSettingsEnvelope>(
    "public-app-settings",
    {},
    { signal: opts?.signal, timeoutMs: opts?.timeoutMs },
  );

  const version = Number((data as any)?.version ?? 1) || 1;
  const settings = mergePublicSettings((data as any)?.settings ?? null);

  return { version, settings };
}

export function getSettingString(
  settings: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const v = settings[key];
  return typeof v === "string" && v.length ? v : fallback;
}

export function getSettingNumber(
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function getDefaultSettingNumber(key: PublicSettingKey): number {
  return DEFAULT_PUBLIC_SETTINGS[key] as unknown as number;
}

export function getDefaultSettingString(key: PublicSettingKey): string {
  return DEFAULT_PUBLIC_SETTINGS[key] as unknown as string;
}
