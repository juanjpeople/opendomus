"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RecentVisit {
  href: string;
  at: number;
}

const MAX_RECENT = 8;

interface NavigationState {
  /** Páginas visitadas por perfil, de la más reciente a la más vieja (sin repetidos). */
  recent: Record<string, RecentVisit[]>;
  visit: (profileId: string, href: string) => void;
  clearRecent: (profileId: string) => void;
}

/** Historial de navegación persistido (alimenta "Recientes" en la búsqueda). */
export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      recent: {},
      visit: (profileId, href) =>
        set((state) => {
          const previous = state.recent[profileId] ?? [];
          if (previous[0]?.href === href) return state;
          const next = [{ href, at: Date.now() }, ...previous.filter((visit) => visit.href !== href)].slice(0, MAX_RECENT);
          return { recent: { ...state.recent, [profileId]: next } };
        }),
      clearRecent: (profileId) =>
        set((state) => {
          const recent = { ...state.recent };
          delete recent[profileId];
          return { recent };
        }),
    }),
    { name: "opendomus-navigation", version: 1 },
  ),
);

interface UiState {
  paletteOpen: boolean;
  /** Menú en Drawer (mobile o menú oculto en escritorio). */
  navDrawerOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setNavDrawerOpen: (open: boolean) => void;
}

/** Estado efímero de la interfaz (no se persiste). */
export const useUiStore = create<UiState>()((set) => ({
  paletteOpen: false,
  navDrawerOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setNavDrawerOpen: (navDrawerOpen) => set({ navDrawerOpen }),
}));
