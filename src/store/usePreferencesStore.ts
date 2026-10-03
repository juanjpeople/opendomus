"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

export const DEFAULT_APPEARANCE = {
  themeMode: "system" as ThemeMode,
  brandColor: "#1677ff",
  borderRadius: 8,
};

interface PreferencesState {
  themeMode: ThemeMode;
  brandColor: string;
  borderRadius: number;
  setThemeMode: (themeMode: ThemeMode) => void;
  setBrandColor: (brandColor: string) => void;
  setBorderRadius: (borderRadius: number) => void;
  resetAppearance: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_APPEARANCE,
      setThemeMode: (themeMode) => set({ themeMode }),
      setBrandColor: (brandColor) => set({ brandColor }),
      setBorderRadius: (borderRadius) => set({ borderRadius }),
      resetAppearance: () => set(DEFAULT_APPEARANCE),
    }),
    { name: "opendomus-preferences", version: 1 },
  ),
);
