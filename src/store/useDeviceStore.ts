"use client";

import { houseStorageKey } from "@/lib/demo";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Dónde vive la casa en ESTE dispositivo:
 * - `unset`: primera vez, todavía no eligió (se muestra la landing y la bienvenida);
 * - `local`: solo en este dispositivo, sin cuenta (lo de siempre);
 * - `cloud`: casa en la nube, cifrada de extremo a extremo y sincronizada (en construcción).
 */
export type DataMode = "unset" | "local" | "cloud";

interface DeviceState {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
}

/** Quien ya usaba la app (tiene un perfil elegido) sigue en modo local: nadie pierde su casa. */
function initialMode(): DataMode {
  if (typeof window === "undefined") return "unset";
  try {
    const session = JSON.parse(localStorage.getItem(houseStorageKey("refugio-session")) ?? "null") as { state?: { currentProfileId?: string | null } } | null;
    return session?.state?.currentProfileId ? "local" : "unset";
  } catch {
    return "unset";
  }
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      mode: initialMode(),
      setMode: (mode) => set({ mode }),
    }),
    { name: houseStorageKey("refugio-device"), version: 1 },
  ),
);
