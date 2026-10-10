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

/**
 * Segundos que espera un esqueleto de carga antes de aparecer (`LoadingSkeleton`). Los datos son
 * locales y casi siempre llegan antes: así no parpadea un esqueleto en cada cambio de página.
 */
export const SKELETON_DELAY = 0.3;

/** Separación entre elementos de una lista que entra escalonada. */
export const STAGGER = 0.05;

/**
 * Cuánto sube (px) lo que se puede tocar al pasar el mouse. Siempre con SPRING.snappy.
 * hero: tarjetas grandes de elección (perfiles, caminos de inicio) · card: tarjetas y fichas ·
 * chip: opciones chicas, pestañas y eventos.
 */
export const HOVER_LIFT = { hero: -6, card: -4, chip: -2 } as const;

/** Escala al apretar: tarjetas casi no ceden; controles chicos, un poco más. */
export const TAP = { card: 0.98, control: 0.97 } as const;
