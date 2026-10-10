import type { Skin } from "./types";

/**
 * Fondo de una tarjeta tintada con el color de un lugar: degradado suave hacia el color de la tarjeta,
 * o plano si el skin no usa tintes. `stop` es el punto (en %) donde el degradado llega al fondo.
 */
export function surfaceBackground(skin: Skin, tint: string, container: string, stop = 60): string {
  return skin.tintedSurfaces ? `linear-gradient(160deg, ${tint} 0%, ${container} ${stop}%)` : container;
}

/** Fondo con halo de color de marca (un gradiente `radial-gradient(...)`) sobre `base`; sin halo, solo `base`. */
export function haloBackground(skin: Skin, gradient: string, base?: string): string | undefined {
  if (!skin.halo) return base;
  return base ? `${gradient}, ${base}` : gradient;
}
