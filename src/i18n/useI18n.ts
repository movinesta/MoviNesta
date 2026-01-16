import { useCallback, useMemo } from "react";
import en from "./en.json";
import es from "./es.json";
import { useUIStore } from "@/lib/ui-store";

const locales = {
  en,
  es,
};

type LanguageSetting = ReturnType<typeof useUIStore.getState>["language"];
export type SupportedLocale = keyof typeof locales;
export type TranslationKey = keyof typeof en;

function resolveSystemLanguage(): SupportedLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.toLowerCase() ?? "en";
  if (lang.startsWith("es")) return "es";
  return "en";
}

export function resolveLanguagePreference(language: LanguageSetting): SupportedLocale {
  if (language === "system") {
    return resolveSystemLanguage();
  }
  return language === "es" ? "es" : "en";
}

export function getPreferredLanguageForTmdb(): string {
  const lang = resolveLanguagePreference(useUIStore.getState().language);
  return lang === "es" ? "es-ES" : "en-US";
}

export function useI18n() {
  const languageSetting = useUIStore((state) => state.language);

  const language = useMemo(() => resolveLanguagePreference(languageSetting), [languageSetting]);

  const t = useCallback(
    (key: TranslationKey) => {
      const localeTable = locales[language] ?? locales.en;
      return (localeTable[key] ?? locales.en[key] ?? key) as string;
    },
    [language],
  );

  return { t, language } as const;
}
