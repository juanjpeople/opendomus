/**
 * Fotos, genéricas: pertenecen a algo (`ownerType` + `ownerId`). Hoy, recetas; mañana, la
 * bóveda, los productos o lo que haga falta, sin tablas nuevas. Se guardan como Blob en el
 * dispositivo, comprimidas antes de guardar.
 *
 * Con la casa en la nube, los datos de la foto se sincronizan como cualquier cosa, pero los bytes
 * no: se suben aparte, cifrados con una clave propia de la foto (`key`), y los demás dispositivos
 * los bajan cuando la ven (ver `src/lib/sync/photos.ts`).
 */

export type PhotoOwner = "recipe";

export interface Photo {
  id: string;
  ownerType: PhotoOwner;
  ownerId: string;
  /** Imagen comprimida (máx. `PHOTO_LIMITS.maxSide` px de lado). Puede faltar si vino de otro dispositivo y todavía no se bajó. */
  blob?: Blob;
  /** Miniatura para listas y tarjetas (igual: puede faltar hasta bajarla). */
  thumb?: Blob;
  /** Clave de la foto (AES-256, base64url). Viaja cifrada dentro del registro de la casa. */
  key?: string;
  /** Los bytes ya están en la nube (cifrados): los demás dispositivos los pueden bajar. */
  uploaded?: boolean;
  /** Formato de la imagen (`image/webp`, `image/jpeg`), para mostrarla al bajarla. */
  mime?: string;
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
