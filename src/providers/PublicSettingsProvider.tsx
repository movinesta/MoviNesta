import * as React from "react";

import { DEFAULT_PUBLIC_SETTINGS } from "@/lib/settings/defaultPublicSettings";
import {
  fetchPublicSettings,
  getSettingNumber,
  getSettingString,
} from "@/lib/settings/publicSettingsApi";
import { getPublicSettingsSnapshot, setPublicSettings } from "@/lib/settings/publicSettingsStore";

type PublicSettingsCtx = {
  ready: boolean;
  version: number;
  settings: Record<string, unknown>;
  refresh: () => Promise<void>;
  getNumber: (key: string, fallback: number) => number;
  getString: (key: string, fallback: string) => string;
};

const PublicSettingsContext = React.createContext<PublicSettingsCtx | null>(null);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const hydrated = React.useMemo(() => getPublicSettingsSnapshot(), []);
  const [ready, setReady] = React.useState(false);
  const [version, setVersion] = React.useState(hydrated.version ?? 1);
  const [settings, setSettings] = React.useState<Record<string, unknown>>(
    hydrated.settings ?? { ...DEFAULT_PUBLIC_SETTINGS },
  );

  const refresh = React.useCallback(async () => {
    try {
      const loaded = await fetchPublicSettings({ timeoutMs: 10_000 });
      setVersion(loaded.version);
      setSettings(loaded.settings);
      // Make settings available to non-React modules.
      setPublicSettings(loaded.version, loaded.settings);
    } catch {
      // Keep defaults; settings are best-effort.
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const getNumber = React.useCallback(
    (key: string, fallback: number) => getSettingNumber(settings, key, fallback),
    [settings],
  );

  const getString = React.useCallback(
    (key: string, fallback: string) => getSettingString(settings, key, fallback),
    [settings],
  );

  const value = React.useMemo<PublicSettingsCtx>(
    () => ({ ready, version, settings, refresh, getNumber, getString }),
    [ready, version, settings, refresh, getNumber, getString],
  );

  return <PublicSettingsContext.Provider value={value}>{children}</PublicSettingsContext.Provider>;
}

export function usePublicSettings(): PublicSettingsCtx {
  const ctx = React.useContext(PublicSettingsContext);
  if (ctx) return ctx;

  // Safe fallback if provider wasn't mounted for some reason.
  return {
    ready: false,
    version: 1,
    settings: { ...DEFAULT_PUBLIC_SETTINGS },
    refresh: async () => {},
    getNumber: (key: string, fallback: number) =>
      getSettingNumber(DEFAULT_PUBLIC_SETTINGS as any, key, fallback),
    getString: (key: string, fallback: string) =>
      getSettingString(DEFAULT_PUBLIC_SETTINGS as any, key, fallback),
  };
}
