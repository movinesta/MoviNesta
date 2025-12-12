import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MainTabKey = "home" | "swipe" | "messages" | "search" | "diary";

type ThemeOption = "system" | "dark" | "light";

interface UIState {
  lastVisitedTab: MainTabKey;
  startTab: Exclude<MainTabKey, "messages" | "search">;
  theme: ThemeOption;
  reduceMotion: boolean;
  language: "system" | "en" | "es";
  setLastVisitedTab: (tab: MainTabKey) => void;
  setStartTab: (tab: Exclude<MainTabKey, "messages" | "search">) => void;
  setTheme: (theme: ThemeOption) => void;
  setReduceMotion: (value: boolean) => void;
  setLanguage: (lang: UIState["language"]) => void;
}

const STORAGE_KEY = "moviNesta.ui";

function resolvePreferredTheme(theme: ThemeOption): "dark" | "light" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: ThemeOption) {
  if (typeof document === "undefined") return;
  const resolved = resolvePreferredTheme(theme);
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const applyThemePreference = applyTheme;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      lastVisitedTab: "home",
      startTab: "home",
      theme: "dark",
      reduceMotion: false,
      language: "system",
      setLastVisitedTab: (tab) => set({ lastVisitedTab: tab }),
      setStartTab: (tab) => set({ startTab: tab }),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setReduceMotion: (value) => set({ reduceMotion: value }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
      version: 1,
    },
  ),
);

export const syncSystemThemePreference = () => {
  if (typeof window === "undefined") return;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const update = () => {
    const currentTheme = useUIStore.getState().theme;
    if (currentTheme === "system") {
      applyTheme(currentTheme);
    }
  };

  mediaQuery.addEventListener("change", update);
  update();

  return () => mediaQuery.removeEventListener("change", update);
};
