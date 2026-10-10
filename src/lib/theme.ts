import { theme, type ThemeConfig } from "antd";
import type { Skin } from "@/skins/types";
import type { FontSize, Preferences } from "./preferences";

export const FONT_SIZES: Record<FontSize, number> = { sm: 13, md: 14, lg: 16, xl: 18 };
export const REDUCED_MOTION = { system: "user", reduced: "always", full: "never" } as const;

/** Sombras de antd según la elevación del skin. Sin skin (o "soft" sin sombra propia) quedan las de antd. */
function shadowTokens(skin: Skin) {
  if (skin.elevation === "soft") {
    return skin.softShadow ? { boxShadow: skin.softShadow, boxShadowSecondary: skin.softShadow, boxShadowTertiary: skin.softShadow } : {};
  }
  return { boxShadow: "none", boxShadowSecondary: "none", boxShadowTertiary: "none" };
}

/** Tema puro compartido por la app y el operador, sin inicializar sesión ni stores. */
export function createTheme(
  preferences: Pick<Preferences, "brandColor" | "borderRadius" | "fontSize" | "density" | "motion">,
  isDark: boolean,
  skin?: Skin,
): ThemeConfig {
  // Un skin puede tener un color de marca propio para el modo oscuro, mientras la persona no haya elegido otro.
  const brandColor = isDark && skin?.brandColorDark && preferences.brandColor === skin.brandColor ? skin.brandColorDark : preferences.brandColor;
  const algorithm = [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (preferences.density === "compact") algorithm.push(theme.compactAlgorithm);
  return {
    algorithm,
    token: {
      fontFamily: "inherit",
      colorPrimary: brandColor,
      borderRadius: preferences.borderRadius,
      fontSize: FONT_SIZES[preferences.fontSize],
      motion: preferences.motion !== "reduced",
      ...(skin?.surfaces ? skin.surfaces[isDark ? "dark" : "light"] : {}),
      ...(skin ? shadowTokens(skin) : {}),
    },
  };
}
