/**
 * Fotos, genéricas: pertenecen a algo (`ownerType` + `ownerId`). Hoy, recetas; mañana, la
 * bóveda, los productos o lo que haga falta, sin tablas nuevas. Se guardan como Blob en el
 * dispositivo, comprimidas antes de guardar. Nada se sube a ningún lado.
 */

export type PhotoOwner = "recipe";

export interface Photo {
  id: string;
  ownerType: PhotoOwner;
  ownerId: string;
  /** Imagen comprimida (máx. `PHOTO_LIMITS.maxSide` px de lado). */
  blob: Blob;
  /** Miniatura para listas y tarjetas. */
  thumb: Blob;
  width: number;
  height: number;
  createdBy: string;
  createdAt: number;
}

export const PHOTO_LIMITS = {
  maxSide: 1600,
  thumbSide: 480,
  quality: 0.8,
  /** Tope del archivo original (antes de comprimir). */
  maxInputBytes: 25 * 1024 * 1024,
  maxPerOwner: 12,
} as const;

/** Medidas para que el lado más largo no pase de `maxSide` (nunca agranda). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
