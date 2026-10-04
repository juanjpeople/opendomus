"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isLocale, type Locale } from "@/i18n/config";

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

/** Opciones válidas por clave: lo que se lee de localStorage se valida contra esto (puede estar editado a mano). */
const VALID: { [K in keyof Preferences]: (value: unknown) => boolean } = {
  themeMode: (v) => v === "light" || v === "dark" || v === "system",
  brandColor: (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v),
  borderRadius: (v) => typeof v === "number" && v >= 0 && v <= 20,
  fontSize: (v) => v === "sm" || v === "md" || v === "lg" || v === "xl",
  density: (v) => v === "comfortable" || v === "compact",
  motion: (v) => v === "system" || v === "reduced" || v === "full",
  locale: (v) => v === "system" || isLocale(v),
  sidebar: (v) => v === "expanded" || v === "collapsed" || v === "hidden",
  autoLockMinutes: (v) => (AUTO_LOCK_OPTIONS as readonly unknown[]).includes(v),
};

function sanitize(input: unknown): Partial<Preferences> {
  if (!input || typeof input !== "object") return {};
  const out: Partial<Record<keyof Preferences, unknown>> = {};
  for (const key of Object.keys(VALID) as (keyof Preferences)[]) {
    const value = (input as Record<string, unknown>)[key];
    if (VALID[key](value)) out[key] = value;
  }
  return out as Partial<Preferences>;
}

/** `null` = sin sesión (selector de perfil, landing): se escribe en los valores del dispositivo. */
type Scope = string | null;

interface PreferencesState {
  /** Valores base del dispositivo. Los usa quien no personalizó nada. */
  device: Preferences;
  /** Personalizaciones por perfil (solo las claves que cambió cada uno). */
  profiles: Record<string, Partial<Preferences>>;
  setPreference: <K extends keyof Preferences>(scope: Scope, key: K, value: Preferences[K]) => void;
  resetPreferences: (scope: Scope) => void;
}

/**
 * Preferencias de interfaz. En componentes no leer el store directo: usar
 * `usePreferences()` / `useSetPreference()` (`@/hooks/usePreferences`), que resuelven el perfil actual.
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      device: DEFAULT_PREFERENCES,
      profiles: {},
      setPreference: (scope, key, value) => {
        if (!VALID[key](value)) return;
        set((state) =>
          scope === null
            ? { device: { ...state.device, [key]: value } }
            : { profiles: { ...state.profiles, [scope]: { ...state.profiles[scope], [key]: value } } },
        );
      },
      resetPreferences: (scope) =>
        set((state) => {
          if (scope === null) return { device: DEFAULT_PREFERENCES };
          const profiles = { ...state.profiles };
          delete profiles[scope];
          return { profiles };
        }),
    }),
    {
      name: "opendomus-preferences",
      version: 2,
      // v1 guardaba { themeMode, brandColor, borderRadius } planos y globales: pasan a ser los del dispositivo.
      migrate: (persisted, version) => {
        if (version < 2) return { device: { ...DEFAULT_PREFERENCES, ...sanitize(persisted) }, profiles: {} };
        return persisted as PreferencesState;
      },
      // Lo persistido se valida al cargar: un valor inválido vuelve al default en vez de romper la UI.
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<PreferencesState>;
        const profiles: Record<string, Partial<Preferences>> = {};
        for (const [id, prefs] of Object.entries(raw.profiles ?? {})) profiles[id] = sanitize(prefs);
        return { ...current, device: { ...DEFAULT_PREFERENCES, ...sanitize(raw.device) }, profiles };
      },
      partialize: ({ device, profiles }) => ({ device, profiles }),
    },
  ),
);
