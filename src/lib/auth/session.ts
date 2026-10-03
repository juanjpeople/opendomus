"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Actor } from "./permissions";

/**
 * Perfiles del hogar. Por ahora son fijos y sin PIN: elegir un perfil = iniciar sesión.
 * Cuando haya backend, esta lista viene del servidor y el inicio de sesión se valida allí.
 */
export const HOUSEHOLD_PROFILES: readonly Actor[] = [
  { id: "profile-admin", name: "Administrador", role: "admin" },
  { id: "profile-adult", name: "Adulto", role: "adult" },
  { id: "profile-kid", name: "Explorador", role: "kid" },
];

interface SessionState {
  currentProfileId: string | null;
  signIn: (profileId: string) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      signIn: (profileId) => {
        if (HOUSEHOLD_PROFILES.some((p) => p.id === profileId)) {
          set({ currentProfileId: profileId });
        }
      },
      signOut: () => set({ currentProfileId: null }),
    }),
    { name: "opendomus-session", version: 1 },
  ),
);

/** Usuario actual o `null`. Un id persistido que ya no existe cuenta como sesión cerrada. */
export function useCurrentUser(): Actor | null {
  const profileId = useSessionStore((s) => s.currentProfileId);
  return HOUSEHOLD_PROFILES.find((p) => p.id === profileId) ?? null;
}
