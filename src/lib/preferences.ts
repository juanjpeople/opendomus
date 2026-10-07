import type { Locale } from "@/i18n/config";

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type Density = "comfortable" | "compact";
export type MotionPreference = "system" | "reduced" | "full";
export type LocalePreference = Locale | "system";
export type SidebarMode = "expanded" | "collapsed" | "hidden";
export const AUTO_LOCK_OPTIONS = [0, 1, 5, 15, 60] as const;
export type AutoLockMinutes = (typeof AUTO_LOCK_OPTIONS)[number];

export interface Preferences {
  themeMode: ThemeMode;
  brandColor: string;
  borderRadius: number;
  fontSize: FontSize;
  density: Density;
  motion: MotionPreference;
  locale: LocalePreference;
  sidebar: SidebarMode;
  /** Bloqueo por inactividad para perfiles con PIN o biometría (0 = nunca). */
  autoLockMinutes: AutoLockMinutes;
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: "system",
  brandColor: "#1677ff",
  borderRadius: 8,
  fontSize: "md",
  density: "comfortable",
  motion: "system",
  locale: "system",
  sidebar: "expanded",
  autoLockMinutes: 15,
};

/** Colores de marca sugeridos (Ajustes y sistema de diseño). */
export const BRAND_PRESETS = ["#1677ff", "#722ed1", "#13c2c2", "#52c41a", "#fa8c16", "#eb2f96"] as const;

