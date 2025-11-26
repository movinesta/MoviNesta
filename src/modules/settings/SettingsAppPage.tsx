import React, { useEffect, useState } from "react";
import { Monitor, Film, Moon, SunMedium, AlertCircle, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "moviNesta.appSettings";

type StartTabOption = "home" | "swipe" | "diary";

interface AppSettings {
  startTab: StartTabOption;
  theme: "system" | "dark";
  reduceMotion: boolean;
}

const defaultSettings: AppSettings = {
  startTab: "home",
  theme: "dark",
  reduceMotion: false,
};

const SettingsAppPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppSettings;
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const updateField =
    <K extends keyof AppSettings>(field: K) =>
    (value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
      setStatus("idle");
    };

  const handleSave = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      {/* Header */}
      <header className="space-y-1 px-4 pt-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mn-text-muted">
          Settings
        </p>
        <h1 className="text-xl font-heading font-semibold text-mn-text-primary">
          App
        </h1>
        <p className="text-[11px] text-mn-text-secondary">
          Customize how MoviNesta behaves on this device.
        </p>
      </header>

      <section className="space-y-4 px-4 pb-24">
        {/* Start tab */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Film className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                Start screen
              </h2>
              <p className="text-[11px] text-mn-text-secondary">
                Choose which tab you land on when you open MoviNesta.
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            {[
              { key: "home" as StartTabOption, label: "Home" },
              { key: "swipe" as StartTabOption, label: "Swipe" },
              { key: "diary" as StartTabOption, label: "Diary" },
            ].map((option) => {
              const isActive = settings.startTab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => updateField("startTab")(option.key)}
                  className={`flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? "border-mn-accent bg-mn-accent/20 text-mn-accent"
                      : "border-mn-border-subtle/80 bg-mn-bg text-mn-text-secondary hover:border-mn-border-strong/80 hover:bg-mn-bg-elevated"
                  }`}
                >
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-mn-text-muted">
            This is stored locally. You can later hook it into navigation logic if needed.
          </p>
        </div>

        {/* Theme */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Monitor className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                Theme
              </h2>
              <p className="text-[11px] text-mn-text-secondary">
                MoviNesta currently runs in dark mode. Light mode can be added later.
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => updateField("theme")("system")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                settings.theme === "system"
                  ? "border-mn-accent bg-mn-accent/20 text-mn-accent"
                  : "border-mn-border-subtle/80 bg-mn-bg text-mn-text-secondary hover:border-mn-border-strong/80 hover:bg-mn-bg-elevated"
              }`}
            >
              <SunMedium className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Match system</span>
            </button>
            <button
              type="button"
              onClick={() => updateField("theme")("dark")}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                settings.theme === "dark"
                  ? "border-mn-accent bg-mn-accent/20 text-mn-accent"
                  : "border-mn-border-subtle/80 bg-mn-bg text-mn-text-secondary hover:border-mn-border-strong/80 hover:bg-mn-bg-elevated"
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Always dark</span>
            </button>
          </div>
          <p className="mt-1 text-[10px] text-mn-text-muted">
            TODO: Wire this into a real theme switcher once light mode is supported.
          </p>
        </div>

        {/* Motion */}
        <div className="space-y-3 rounded-mn-card border border-mn-border-subtle/80 bg-mn-bg-elevated/80 p-4 shadow-mn-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-mn-border-subtle/50">
              <Moon className="h-4 w-4 text-mn-text-secondary" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-mn-text-primary">
                Motion
              </h2>
              <p className="text-[11px] text-mn-text-secondary">
                Reduce some of the more cinematic animations.
              </p>
            </div>
          </div>

          <label className="mt-2 flex items-center justify-between gap-3 text-[12px]">
            <div>
              <span className="block text-mn-text-primary">Reduce motion</span>
              <span className="block text-[11px] text-mn-text-secondary">
                Fewer transitions and subtle effects. Great if you prefer a calmer UI.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(e) => updateField("reduceMotion")(e.target.checked)}
              className="h-4 w-4 rounded border-mn-border-subtle bg-mn-bg text-mn-accent"
            />
          </label>
        </div>

        {/* Status + save */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-h-[20px] flex-1 text-[11px]">
            {status === "saved" && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>App settings saved to this device.</span>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-1.5 text-mn-error">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Couldn&apos;t save settings. Try again.</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-full bg-mn-accent/90 px-3.5 py-1.5 text-xs font-medium text-black shadow-mn-card transition hover:bg-mn-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mn-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-mn-bg"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Save settings</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsAppPage;
