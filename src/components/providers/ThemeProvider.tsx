"use client";

import { App, ConfigProvider, theme } from "antd";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import { MotionConfig } from "framer-motion";
import { LucideProvider } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useIsDark } from "@/hooks/useIsDark";
import { usePreferences } from "@/hooks/usePreferences";
import { useI18n, type Locale } from "@/i18n";
import type { FontSize, MotionPreference } from "@/store/usePreferencesStore";

const ANTD_LOCALES = { es: esES, en: enUS } satisfies Record<Locale, unknown>;

/** Tamaño base del texto (px) por preferencia. Todo el resto de tamaños de antd se deriva de este. */
export const FONT_SIZES: Record<FontSize, number> = { sm: 13, md: 14, lg: 16, xl: 18 };

const REDUCED_MOTION = { system: "user", reduced: "always", full: "never" } as const satisfies Record<MotionPreference, string>;

/**
 * Tema global. Todo color/radio/tamaño sale de acá vía tokens de antd:
 * en componentes usar `theme.useToken()`, nunca valores hex escritos a mano.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const isDark = useIsDark();
  const { locale } = useI18n();
  const { brandColor, borderRadius, fontSize, density, motion } = usePreferences();
  const baseFontSize = FONT_SIZES[fontSize];

  // Los tamaños en `rem` (títulos con clamp) escalan con el html; los de antd, con el token.
  useEffect(() => {
    document.documentElement.style.fontSize = `${(baseFontSize / FONT_SIZES.md) * 100}%`;
  }, [baseFontSize]);

  const algorithm = [isDark ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (density === "compact") algorithm.push(theme.compactAlgorithm);

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale]}
      theme={{
        algorithm,
        token: {
          fontFamily: "inherit",
          colorPrimary: brandColor,
          borderRadius,
          fontSize: baseFontSize,
          // "Reducidas" también apaga las animaciones propias de antd (modales, menús…).
          motion: motion !== "reduced",
        },
      }}
    >
      {/* Íconos: lucide-react. El tamaño sigue al font-size (ver .lucide en globals.css). */}
      <LucideProvider strokeWidth={2}>
        {/* framer-motion: "sistema" respeta prefers-reduced-motion del sistema operativo. */}
        <MotionConfig reducedMotion={REDUCED_MOTION[motion]}>
          {/* <App> habilita message/notification/modal con el tema actual vía App.useApp(). */}
          <App>{children}</App>
        </MotionConfig>
      </LucideProvider>
    </ConfigProvider>
  );
}
