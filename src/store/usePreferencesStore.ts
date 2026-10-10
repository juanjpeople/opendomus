"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_PREFERENCES, isValidPreference, sanitizePreferences as sanitize, type Preferences } from "@/lib/preferences";
export * from "@/lib/preferences";

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
        if (!isValidPreference(key, value)) return;
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
      name: "refugio-preferences",
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
