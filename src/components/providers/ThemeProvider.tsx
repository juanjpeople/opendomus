"use client";

import { App, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";
import { LucideProvider } from "lucide-react";
import type { ReactNode } from "react";
import { useIsDark } from "@/hooks/useIsDark";
import { usePreferencesStore } from "@/store/usePreferencesStore";

/**
 * Tema global. Todo color/radio/tamaño sale de acá vía tokens de antd:
 * en componentes usar `theme.useToken()`, nunca valores hex escritos a mano.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const isDark = useIsDark();
  const brandColor = usePreferencesStore((s) => s.brandColor);
  const borderRadius = usePreferencesStore((s) => s.borderRadius);

  return (
    <ConfigProvider
      locale={esES}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { fontFamily: "inherit", colorPrimary: brandColor, borderRadius },
      }}
    >
      {/* Íconos: lucide-react. El tamaño sigue al font-size (ver .lucide en globals.css). */}
      <LucideProvider strokeWidth={2}>
        {/* <App> habilita message/notification/modal con el tema actual vía App.useApp(). */}
        <App>{children}</App>
      </LucideProvider>
    </ConfigProvider>
  );
}
