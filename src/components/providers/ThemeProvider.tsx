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
import { getSkin } from "@/skins/skins";
import { SkinContext } from "@/skins/useSkin";
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
  const { brandColor, borderRadius, fontSize, density, motion, skin: skinId } = usePreferences();
  const skin = getSkin(skinId);
  const baseFontSize = FONT_SIZES[fontSize];

  // Los tamaños en `rem` (títulos con clamp) escalan con el html; los de antd, con el token.
  useEffect(() => {
    document.documentElement.style.fontSize = `${(baseFontSize / FONT_SIZES.md) * 100}%`;
  }, [baseFontSize]);

  // El skin también se refleja en el html: el CSS global lo usa para las tipografías de los títulos.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = skin.id;
    if (skin.headingFont) root.style.setProperty("--od-font-heading", skin.headingFont);
    else root.style.removeProperty("--od-font-heading");
  }, [skin]);

  return (
    <ConfigProvider
      locale={ANTD_LOCALES[locale]}
      theme={createTheme({ brandColor, borderRadius, fontSize, density, motion }, isDark, skin)}
    >
      {/* Íconos: lucide-react. El tamaño sigue al font-size (ver .lucide en globals.css). */}
      <LucideProvider strokeWidth={2}>
        {/* framer-motion: "sistema" respeta prefers-reduced-motion del sistema operativo. */}
        <MotionConfig reducedMotion={REDUCED_MOTION[motion]}>
          {/* <App> habilita message/notification/modal con el tema actual vía App.useApp(). */}
          <SkinContext.Provider value={skin}>
            <App>{children}</App>
          </SkinContext.Provider>
        </MotionConfig>
      </LucideProvider>
    </ConfigProvider>
  );
}
