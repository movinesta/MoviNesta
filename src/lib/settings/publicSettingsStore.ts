// src/lib/settings/publicSettingsStore.ts
//
// Lightweight module-level store for PUBLIC (non-secret) settings.
//
// Why this exists:
// - Some modules (e.g. service files) aren't React components and can't use hooks.
// - We still want them to access the latest loaded public settings.
//
// Security:
// - Only public-scope settings may be stored here.
// - This store never holds secrets.

import { DEFAULT_PUBLIC_SETTINGS } from "./defaultPublicSettings";

type StoredEnvelope = {
  version: number;
  settings: Record<string, unknown>;
};

const LS_KEY = "movinesta.public_settings.v1";

let currentVersion = 1;
let currentSettings: Record<string, unknown> = { ...DEFAULT_PUBLIC_SETTINGS };

function mergeWithDefaults(
  remote: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...DEFAULT_PUBLIC_SETTINGS };
  if (!remote) return merged;
  for (const [k, v] of Object.entries(remote)) {
    merged[k] = v;
  }
  return merged;
}

function readFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope>;
    const v = Number((parsed as any)?.version ?? 1) || 1;
    const s = (parsed as any)?.settings;
    if (s && typeof s === "object") {
      currentVersion = v;
      currentSettings = mergeWithDefaults(s as any);
    }
  } catch {
    // ignore
  }
}

function writeToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const env: StoredEnvelope = { version: currentVersion, settings: currentSettings };
    window.localStorage.setItem(LS_KEY, JSON.stringify(env));
  } catch {
    // ignore
  }
}

// Best-effort hydrate at module load (keeps UX stable before first network fetch).
readFromStorage();

export function setPublicSettings(version: number, settings: Record<string, unknown>) {
  currentVersion = Number(version || 1) || 1;
  currentSettings = mergeWithDefaults(settings);
  writeToStorage();
}

export function getPublicSettingsSnapshot(): {
  version: number;
  settings: Record<string, unknown>;
} {
  return { version: currentVersion, settings: { ...currentSettings } };
}

export function getPublicSettingNumber(key: string, fallback: number): number {
  const v = currentSettings[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function getPublicSettingString(key: string, fallback: string): string {
  const v = currentSettings[key];
  return typeof v === "string" && v.length ? v : fallback;
}
