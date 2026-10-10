import type { Skin, SkinId } from "./types";

/**
 * Catálogo de skins. "Casa" es el aspecto original: no cambia ningún token de antd, así que la app
 * se ve igual que antes. Los hex viven solo acá (el lint de diseño los prohíbe en los `.tsx`).
 */
export const SKINS: Record<SkinId, Skin> = {
  casa: {
    id: "casa",
    brandColor: "#1677ff",
    borderRadius: 8,
    surfaces: null,
    elevation: "soft",
    softShadow: null,
    tintedSurfaces: true,
    halo: true,
    textured: true,
    headingFont: null,
    illustration: { stroke: 2, rounded: true },
  },
  calido: {
    id: "calido",
    brandColor: "#b45309",
    brandColorDark: "#d97706",
    borderRadius: 14,
    surfaces: {
      light: { colorBgLayout: "#faf5ee", colorBgContainer: "#fffdf9", colorBgElevated: "#fffdf9", colorBorder: "#e3d5c0", colorBorderSecondary: "#efe4d3" },
      dark: { colorBgLayout: "#15110d", colorBgContainer: "#1e1914", colorBgElevated: "#26201a", colorBorder: "#453a2c", colorBorderSecondary: "#322a20" },
    },
    elevation: "soft",
    softShadow: "0 4px 18px rgba(120, 78, 30, 0.10)",
    tintedSurfaces: true,
    halo: true,
    textured: true,
    headingFont: "var(--font-fraunces)",
    illustration: { stroke: 2.25, rounded: true },
  },
  sobrio: {
    id: "sobrio",
    brandColor: "#334155",
    brandColorDark: "#738299",
    borderRadius: 2,
    surfaces: {
      light: { colorBgLayout: "#fafafa", colorBgContainer: "#ffffff", colorBgElevated: "#ffffff", colorBorder: "#d4d4d8", colorBorderSecondary: "#e4e4e7", colorPrimaryBg: "#eceff3", colorPrimaryBgHover: "#e1e6ec" },
      dark: { colorBgLayout: "#0a0a0b", colorBgContainer: "#111113", colorBgElevated: "#18181b", colorBorder: "#3f3f46", colorBorderSecondary: "#27272a", colorPrimaryBg: "#232a33", colorPrimaryBgHover: "#2b3440" },
    },
    elevation: "outlined",
    softShadow: null,
    tintedSurfaces: false,
    halo: false,
    textured: false,
    headingFont: null,
    illustration: { stroke: 1.5, rounded: false },
  },
  oceano: {
    id: "oceano",
    brandColor: "#0e7490",
    brandColorDark: "#0891b2",
    borderRadius: 10,
    surfaces: {
      light: { colorBgLayout: "#f1f6f8", colorBgContainer: "#ffffff", colorBgElevated: "#ffffff", colorBorder: "#cddfe5", colorBorderSecondary: "#e1ecf0" },
      dark: { colorBgLayout: "#061217", colorBgContainer: "#0c1d24", colorBgElevated: "#12262e", colorBorder: "#244049", colorBorderSecondary: "#172f37" },
    },
    elevation: "soft",
    softShadow: "0 6px 20px rgba(8, 47, 73, 0.10)",
    tintedSurfaces: true,
    halo: true,
    textured: true,
    headingFont: null,
    illustration: { stroke: 2, rounded: true },
  },
  jardin: {
    id: "jardin",
    brandColor: "#15803d",
    brandColorDark: "#1a9a4a",
    borderRadius: 12,
    surfaces: {
      light: { colorBgLayout: "#f3f7f0", colorBgContainer: "#fcfdfa", colorBgElevated: "#fcfdfa", colorBorder: "#d4e1cc", colorBorderSecondary: "#e5ede0" },
      dark: { colorBgLayout: "#0c120d", colorBgContainer: "#141c15", colorBgElevated: "#1b251c", colorBorder: "#33442f", colorBorderSecondary: "#243124" },
    },
    elevation: "soft",
    softShadow: "0 4px 16px rgba(21, 83, 45, 0.10)",
    tintedSurfaces: true,
    halo: true,
    textured: true,
    headingFont: null,
    illustration: { stroke: 2.25, rounded: true },
  },
  papel: {
    id: "papel",
    brandColor: "#3f3a33",
    brandColorDark: "#8f8474",
    borderRadius: 4,
    surfaces: {
      light: { colorBgLayout: "#f6f3ec", colorBgContainer: "#fffdf8", colorBgElevated: "#fffdf8", colorBorder: "#d9d2c3", colorBorderSecondary: "#e8e2d5", colorPrimaryBg: "#ece6da", colorPrimaryBgHover: "#e3dccd" },
      dark: { colorBgLayout: "#12110f", colorBgContainer: "#1a1916", colorBgElevated: "#22201c", colorBorder: "#3d3a33", colorBorderSecondary: "#2c2a25", colorPrimaryBg: "#2e2b25", colorPrimaryBgHover: "#38342d" },
    },
    elevation: "outlined",
    softShadow: null,
    tintedSurfaces: false,
    halo: false,
    textured: true,
    headingFont: "var(--font-fraunces)",
    illustration: { stroke: 1.75, rounded: false },
  },
};

export const DEFAULT_SKIN: SkinId = "casa";

export function getSkin(id: SkinId | undefined): Skin {
  return SKINS[id ?? DEFAULT_SKIN];
}
