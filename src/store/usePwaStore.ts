import { create } from "zustand";

/** Evento de Chrome/Edge para instalar la app (no está en los tipos del DOM). */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Estado de la app instalable: conexión, versión nueva lista e instalación. Lo llena `PwaBridge`. */
interface PwaState {
  online: boolean;
  /** Service worker nuevo esperando: hay una versión nueva para aplicar. */
  waiting: ServiceWorker | null;
  /** Se puede ofrecer "Instalar" (solo navegadores que lo permiten y si no está instalada). */
  installPrompt: InstallPromptEvent | null;
  set: (patch: Partial<Omit<PwaState, "set">>) => void;
}

export const usePwaStore = create<PwaState>()((set) => ({
  online: true,
  waiting: null,
  installPrompt: null,
  set: (patch) => set(patch),
}));
