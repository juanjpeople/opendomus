import type { Transition } from "framer-motion";

/**
 * Tokens de movimiento. En la app las animaciones son cortas: acompañan, no hacen esperar.
 * Solo se anima transform y opacity (baratos para el navegador). `MotionConfig` en el
 * ThemeProvider respeta "reducir movimiento" del sistema operativo.
 */
export const DURATION = { fast: 0.18, base: 0.32, slow: 0.6 } as const;

/** Salida suave: arranca rápido y frena al final. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const SPRING = {
  /** Interacciones (hover, indicadores, contadores). */
  snappy: { type: "spring", stiffness: 420, damping: 32 },
  /** Elementos que "se acomodan" (puertas, glifos). */
  soft: { type: "spring", stiffness: 160, damping: 18 },
} satisfies Record<string, Transition>;

/** Separación entre elementos de una lista que entra escalonada. */
export const STAGGER = 0.05;
