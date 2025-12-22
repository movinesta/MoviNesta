import { create } from "zustand";
import { persist } from "zustand/middleware";

export type MainTabKey = "home" | "swipe" | "messages" | "search" | "diary";

interface UIState {
  lastVisitedTab: MainTabKey;
  startTab: Exclude<MainTabKey, "messages" | "search">;
  reduceMotion: boolean;
  language: "system" | "en" | "es";
  setLastVisitedTab: (tab: MainTabKey) => void;
  setStartTab: (tab: Exclude<MainTabKey, "messages" | "search">) => void;
  setReduceMotion: (value: boolean) => void;
  setLanguage: (lang: UIState["language"]) => void;
}

const STORAGE_KEY = "moviNesta.ui";

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      lastVisitedTab: "home",
      startTab: "home",
      reduceMotion: false,
      language: "system",
      setLastVisitedTab: (tab) => set({ lastVisitedTab: tab }),
      setStartTab: (tab) => set({ startTab: tab }),
      setReduceMotion: (value) => set({ reduceMotion: value }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persistedState) => {
        // Strip deprecated theme preferences from older storage versions.
        const { theme: _theme, ...rest } = (persistedState || {}) as Record<string, unknown>;
        return rest as unknown as UIState;
      },
    },
  ),
);
