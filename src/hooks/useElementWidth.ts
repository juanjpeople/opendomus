"use client";

import { useCallback, useState } from "react";

/**
 * Ancho real de un elemento (no de la pantalla): con el menú lateral abierto, el contenido es
 * bastante más angosto que la ventana. Devuelve un ref de callback para el elemento y su ancho
 * (`null` hasta medir).
 */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
