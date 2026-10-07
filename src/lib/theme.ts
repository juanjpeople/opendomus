import { theme, type ThemeConfig } from "antd";
import type { FontSize, Preferences } from "./preferences";

export const FONT_SIZES: Record<FontSize, number> = { sm: 13, md: 14, lg: 16, xl: 18 };
export const REDUCED_MOTION = { system: "user", reduced: "always", full: "never" } as const;

/** Tema puro compartido por la app y el operador, sin inicializar sesión ni stores. */
export function createTheme(
  preferences: Pick<Preferences, "brandColor" | "borderRadius" | "fontSize" | "density" | "motion">,
  isDark: boolean,
): ThemeConfig {
  const algorithm = [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (preferences.density === "compact") algorithm.push(theme.compactAlgorithm);
  return {
    algorithm,
    token: {
      fontFamily: "inherit",
      colorPrimary: preferences.brandColor,
      borderRadius: preferences.borderRadius,
      fontSize: FONT_SIZES[preferences.fontSize],
      motion: preferences.motion !== "reduced",
    },
  };
}
