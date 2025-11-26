import { create } from "zustand";

export type MainTabKey = "home" | "swipe" | "messages" | "search" | "diary";

interface UIState {
  lastVisitedTab: MainTabKey;
  setLastVisitedTab: (tab: MainTabKey) => void;
}

export const useUIStore = create<UIState>((set) => ({
  lastVisitedTab: "home",
  setLastVisitedTab: (tab) => set({ lastVisitedTab: tab }),
}));
