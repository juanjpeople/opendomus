"use client";

import { useCallback, useMemo } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { useCurrentUser } from "@/lib/auth/session";
import { DEFAULT_PREFERENCES, usePreferencesStore, type Preferences } from "@/store/usePreferencesStore";

/**
 * Preferencias efectivas del perfil actual: las del dispositivo + lo que el perfil personalizó.
 * Antes de leer localStorage devuelve los defaults, así el HTML del servidor y el primer
 * render del cliente coinciden (sin errores de hidratación).
 */
export function usePreferences(): Preferences {
  const hydrated = useHydrated();
  const profileId = useCurrentUser()?.id;
  const device = usePreferencesStore((s) => s.device);
  const overrides = usePreferencesStore((s) => (profileId ? s.profiles[profileId] : undefined));

  return useMemo(
    () => (hydrated ? { ...device, ...overrides } : DEFAULT_PREFERENCES),
    [hydrated, device, overrides],
  );
}

/** Cambia una preferencia del perfil actual (o del dispositivo, si no hay sesión). */
export function useSetPreference() {
  const profileId = useCurrentUser()?.id ?? null;
  const setPreference = usePreferencesStore((s) => s.setPreference);

  return useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreference(profileId, key, value),
    [profileId, setPreference],
  );
}

/** Vuelve las preferencias del perfil actual a los valores del dispositivo. */
export function useResetPreferences() {
  const profileId = useCurrentUser()?.id ?? null;
  const resetPreferences = usePreferencesStore((s) => s.resetPreferences);
  return useCallback(() => resetPreferences(profileId), [profileId, resetPreferences]);
}
