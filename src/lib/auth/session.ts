"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isSecured, type Member } from "@/features/members/domain";

/**
 * Miembros de la casa en memoria. Los llena `MembersBridge` (una sola suscripción a la base),
 * así cualquier componente los lee al instante. `null` = todavía cargando.
 */
interface MembersState {
  members: Member[] | null;
  loadFailed: boolean;
  setMembers: (members: Member[]) => void;
  setLoadFailed: () => void;
}

export const useMembersStore = create<MembersState>()((set) => ({
  members: null,
  loadFailed: false,
  setMembers: (members) => set({ members, loadFailed: false }),
  setLoadFailed: () => set({ loadFailed: true }),
}));

interface SessionState {
  /** Qué perfil está usando el dispositivo (persistido: sobrevive a cerrar el navegador). */
  currentProfileId: string | null;
  signIn: (profileId: string) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentProfileId: null,
      signIn: (profileId) => {
        const members = useMembersStore.getState().members;
        if (!members?.some((member) => member.id === profileId)) return;
        // Cambiar de perfil siempre vuelve a bloquear: un desbloqueo anterior no vale para volver después.
        if (useLockStore.getState().unlockedProfileId !== profileId) useLockStore.getState().lock();
        set({ currentProfileId: profileId });
      },
      signOut: () => {
        useLockStore.getState().lock();
        set({ currentProfileId: null });
      },
    }),
    { name: "opendomus-session", version: 1 },
  ),
);

interface LockState {
  /** Perfil desbloqueado en ESTA pestaña (sessionStorage: cerrar la pestaña vuelve a bloquear). */
  unlockedProfileId: string | null;
  /** Última actividad (para el bloqueo automático por inactividad). */
  lastActivity: number;
  unlock: (profileId: string) => void;
  lock: () => void;
  touch: () => void;
}

export const useLockStore = create<LockState>()(
  persist(
    (set) => ({
      unlockedProfileId: null,
      lastActivity: 0,
      unlock: (profileId) => set({ unlockedProfileId: profileId, lastActivity: Date.now() }),
      lock: () => set({ unlockedProfileId: null }),
      touch: () => set({ lastActivity: Date.now() }),
    }),
    { name: "opendomus-lock", version: 1, storage: createJSONStorage(() => sessionStorage) },
  ),
);

/** Usuario actual o `null`. Un id persistido que ya no existe cuenta como sesión cerrada. */
export function useCurrentUser(): Member | null {
  const profileId = useSessionStore((s) => s.currentProfileId);
  const members = useMembersStore((s) => s.members);
  return members?.find((member) => member.id === profileId) ?? null;
}

/** El perfil actual está protegido (PIN o biometría) y todavía no se desbloqueó en esta pestaña. */
export function useIsLocked(): boolean {
  const user = useCurrentUser();
  const unlockedProfileId = useLockStore((s) => s.unlockedProfileId);
  return !!user && isSecured(user) && unlockedProfileId !== user.id;
}
