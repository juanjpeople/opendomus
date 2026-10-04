"use client";

import { useEffect } from "react";
import { create } from "zustand";

export interface Crumb {
  label: string;
  /** Sin `href`, es la página actual. */
  href?: string;
}

interface BreadcrumbState {
  /** Eslabones dinámicos al final de las migas (ej. Placard › Cajón 2 en /inventario/<id>). */
  tail: Crumb[];
  setTail: (tail: Crumb[]) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  tail: [],
  setTail: (tail) => set({ tail }),
}));

/**
 * Para páginas con datos: agrega sus eslabones al final de las migas mientras están montadas.
 * El último es la página actual (y da el título de la pestaña).
 */
export function usePageCrumbs(crumbs: Crumb[] | null | undefined) {
  const setTail = useBreadcrumbStore((s) => s.setTail);
  // Clave estable: el array se recrea en cada render, el contenido no.
  const key = JSON.stringify(crumbs ?? []);
  useEffect(() => {
    setTail(JSON.parse(key) as Crumb[]);
    return () => setTail([]);
  }, [key, setTail]);
}
