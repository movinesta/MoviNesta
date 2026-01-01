import React, { useEffect, useState } from "react";
import { Monitor, Film, Moon, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import TopBar from "../../components/shared/TopBar";
import { useUIStore } from "../../lib/ui-store";
import { useI18n } from "@/i18n/useI18n";
import { useAssistantPrefs, useUpdateAssistantPrefs } from "@/modules/assistant/useAssistantPrefs";
import { clearAssistantQuiet, getAssistantQuietUntil } from "@/modules/assistant/assistantQuiet";

type StartTabOption = "home" | "swipe" | "profile";

const SettingsAppPage: React.FC = () => {
  const { t } = useI18n();
  const { startTab, setStartTab, reduceMotion, setReduceMotion, language, setLanguage } =
    useUIStore();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  // Assistant prefs (stored in Supabase).
  const { data: prefsData } = useAssistantPrefs();
  const updatePrefs = useUpdateAssistantPrefs();
  const prefs = prefsData ?? { enabled: true, proactivityLevel: 1 as const };

  const quietUntil = getAssistantQuietUntil();
  const [isQuiet, setIsQuiet] = useState(false);

  useEffect(() => {
    setIsQuiet(Date.now() < quietUntil);
  }, [quietUntil]);

  const flashSaved = () => {
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const flashError = () => {
    setStatus("error");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const patchAssistantPrefs = (next: { enabled?: boolean; proactivityLevel?: 0 | 1 | 2 }) => {
    updatePrefs.mutate(next, {
      onSuccess: () => flashSaved(),
      onError: () => flashError(),
    });
  };

  const handleSave = () => {
    try {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 pb-2 pt-1">
      <TopBar title={t("settings.app.title")} />

      <section className="space-y-4 px-4 pb-24">
        {/* Start tab */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <Film className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">
                {t("settings.start.title")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("settings.start.description")}</p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            {[
              { key: "home" as StartTabOption, label: "Home" },
              { key: "swipe" as StartTabOption, label: "Swipe" },
              { key: "profile" as StartTabOption, label: "Profile" },
            ].map((option) => {
              const isActive = startTab === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStartTab(option.key)}
                  className={`flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-border hover:bg-card"
                  }`}
                >
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("settings.start.note")}</p>
        </div>

        {/* Assistant */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">
                {t("assistant.settings.title")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("assistant.settings.description")}</p>
            </div>
          </div>

          <label className="mt-2 flex items-center justify-between gap-3 text-[12px]">
            <div>
              <span className="block text-foreground">{t("assistant.settings.enabled")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("assistant.settings.enabledDetail")}
              </span>
            </div>
            <input
              type="checkbox"
              checked={prefs.enabled}
              onChange={(e) => patchAssistantPrefs({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-background text-primary"
              aria-label={t("assistant.settings.enabled")}
            />
          </label>

          <div className="mt-2">
            <div className="text-xs text-muted-foreground mb-2">
              {t("assistant.settings.proactivity")}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              {(
                [
                  { level: 1 as const, label: t("assistant.settings.proactivityBalanced") },
                  { level: 2 as const, label: t("assistant.settings.proactivityBold") },
                ] as const
              ).map((opt) => {
                const isActive = prefs.proactivityLevel === opt.level;
                return (
                  <button
                    key={opt.level}
                    type="button"
                    disabled={!prefs.enabled}
                    onClick={() => patchAssistantPrefs({ proactivityLevel: opt.level })}
                    className={`flex items-center justify-center gap-1 rounded-full border px-3 py-1.5 text-xs transition ${
                      isActive
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-border hover:bg-card"
                    } ${!prefs.enabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("assistant.settings.proactivityNote")}
            </p>
          </div>

          {isQuiet && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
              <span>
                {t("assistant.settings.paused")} {new Date(quietUntil).toLocaleTimeString()}
              </span>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  clearAssistantQuiet();
                  flashSaved();
                }}
              >
                {t("assistant.settings.resume")}
              </button>
            </div>
          )}
        </div>

        {/* Language */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">
                {t("settings.language.title")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("settings.language.description")}</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
            {["system", "en", "es"].map((option) => {
              const labels: Record<string, string> = {
                system: t("settings.language.matchSystem"),
                en: t("settings.language.english"),
                es: t("settings.language.spanish"),
              };
              const isActive = language === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLanguage(option as typeof language)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    isActive
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-border hover:bg-card"
                  }`}
                >
                  <span>{labels[option]}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("settings.language.note")}</p>
          <div className="inline-flex items-center gap-2 rounded-md bg-muted/80 px-3 py-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            <span>{t("settings.language.comingSoon")}</span>
          </div>
        </div>

        {/* Motion */}
        <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-border/50">
              <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="space-y-0.5">
              <h2 className="text-sm font-heading font-semibold text-foreground">
                {t("settings.motion.title")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("settings.motion.description")}</p>
            </div>
          </div>

          <label className="mt-2 flex items-center justify-between gap-3 text-[12px]">
            <div>
              <span className="block text-foreground">{t("settings.motion.reduceMotion")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("settings.motion.detail")}
              </span>
            </div>
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background text-primary"
              aria-label={t("settings.motion.reduceMotion")}
            />
          </label>
        </div>

        {/* Status + save */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-h-[20px] flex-1 text-xs">
            {status === "saved" && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("settings.save.success")}</span>
              </div>
            )}
            {status === "error" && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t("settings.save.error")}</span>
              </div>
            )}
          </div>
          <Button type="button" size="sm" onClick={handleSave}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("settings.save.cta")}</span>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default SettingsAppPage;
