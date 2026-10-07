"use client";

import { App, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import { MotionConfig } from "framer-motion";
import { LucideProvider } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useIsDark } from "@/hooks/useIsDark";
import { usePreferences } from "@/hooks/usePreferences";
import { useI18n, type Locale } from "@/i18n";
import { createTheme, FONT_SIZES, REDUCED_MOTION } from "@/lib/theme";
export { createTheme, FONT_SIZES } from "@/lib/theme";

const ANTD_LOCALES = { es: esES, en: enUS } satisfies Record<Locale, unknown>;

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

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale]}
      theme={createTheme({ brandColor, borderRadius, fontSize, density, motion }, isDark)}
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
