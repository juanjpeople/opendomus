/** Un skin: el estilo completo de la app. Es solo datos; los componentes lo leen con `useSkin()`. */
export const SKIN_IDS = ["casa", "calido", "sobrio", "oceano", "jardin", "papel"] as const;
export type SkinId = (typeof SKIN_IDS)[number];

/** Colores de superficie que un skin cambia de antd (lo que no se lista queda como en "Casa"). */
export interface SkinSurfaces {
  colorBgLayout: string;
  colorBgContainer: string;
  colorBgElevated: string;
  colorBorder: string;
  colorBorderSecondary: string;
  /** Fondo de lo seleccionado (menú, filas): si el color de marca es muy oscuro, la paleta de antd lo deja grisáceo. */
  colorPrimaryBg?: string;
  colorPrimaryBgHover?: string;
}

/** Cómo se levantan las tarjetas del fondo: sombra suave, sin sombra o solo con borde. */
export type Elevation = "soft" | "flat" | "outlined";

export interface Skin {
  id: SkinId;
  /** Color de marca y radio con que se aplica el skin (se pueden ajustar después en Ajustes). */
  brandColor: string;
  /** Color de marca en modo oscuro (el de claro se ve apagado sobre fondos oscuros). Solo rige mientras no se cambie a mano. */
  brandColorDark?: string;
  borderRadius: number;
  /** Superficies propias para claro y oscuro; `null` deja los de antd. */
  surfaces: { light: SkinSurfaces; dark: SkinSurfaces } | null;
  elevation: Elevation;
  /** Sombra de las tarjetas cuando la elevación es `soft` y el skin quiere una propia. */
  softShadow: string | null;
  /** Tarjetas con degradado tintado del color del lugar, o planas. */
  tintedSurfaces: boolean;
  /** Halo de color de marca detrás del contenido y de las pantallas de entrada. */
  halo: boolean;
  /** Textura de los pisos del plano. */
  textured: boolean;
  /** Familias tipográficas (variables CSS de next/font) para títulos y para el resto. */
  headingFont: string | null;
  /** Ilustraciones de la casa: grosor del trazo y esquinas. */
  illustration: { stroke: number; rounded: boolean };
}
