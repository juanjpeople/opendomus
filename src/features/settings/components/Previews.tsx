"use client";

import { theme } from "antd";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { SIDEBAR_WIDTH } from "@/components/layout/constants";
import { SPRING } from "@/lib/motion";
import type { SidebarMode, ThemeMode } from "@/store/usePreferencesStore";

type Token = ReturnType<typeof theme.getDesignToken>;

/** Mini ventana de la app pintada con los tokens de un tema. */
function MiniWindow({ token, sidebarRatio = 0.28 }: { token: Token; sidebarRatio?: number }) {
  const line = (width: string, color = token.colorFillSecondary) => (
    <div style={{ height: 6, width, borderRadius: 3, background: color, marginBottom: 6 }} />
  );

  return (
    <div style={{ display: "flex", height: 72, background: token.colorBgLayout }}>
      <motion.div
        initial={false}
        animate={{ width: `${sidebarRatio * 100}%` }}
        transition={SPRING.snappy}
        style={{
          background: token.colorBgContainer,
          borderInlineEnd: sidebarRatio ? `1px solid ${token.colorBorderSecondary}` : "none",
          padding: sidebarRatio ? 8 : 0,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {line("70%", token.colorPrimary)}
        {line("90%")}
        {line("60%")}
      </motion.div>
      <div style={{ flex: 1, padding: 10 }}>
        {line("45%", token.colorText)}
        {line("80%")}
        <div style={{ height: 18, width: "50%", borderRadius: 4, background: token.colorPrimaryBg, marginTop: 4 }} />
      </div>
    </div>
  );
}

/** Tokens reales de claro y oscuro con el color de marca actual (sin colores escritos a mano). */
function useThemeTokens() {
  const { token } = theme.useToken();
  return useMemo(() => {
    const base = { token: { colorPrimary: token.colorPrimary, borderRadius: token.borderRadius } };
    return {
      light: theme.getDesignToken({ ...base, algorithm: theme.defaultAlgorithm }),
      dark: theme.getDesignToken({ ...base, algorithm: theme.darkAlgorithm }),
    };
  }, [token.colorPrimary, token.borderRadius]);
}

export function ThemePreview({ mode }: { mode: ThemeMode }) {
  const tokens = useThemeTokens();
  if (mode !== "system") return <MiniWindow token={tokens[mode]} />;

  // Sistema: mitad clara, mitad oscura.
  return (
    <div style={{ position: "relative" }}>
      <MiniWindow token={tokens.light} />
      <div style={{ position: "absolute", inset: 0, clipPath: "polygon(55% 0, 100% 0, 100% 100%, 45% 100%)" }}>
        <MiniWindow token={tokens.dark} />
      </div>
    </div>
  );
}

export function SidebarPreview({ mode }: { mode: SidebarMode }) {
  const { token } = theme.useToken();
  return <MiniWindow token={token as Token} sidebarRatio={SIDEBAR_WIDTH[mode] / (SIDEBAR_WIDTH.expanded * 3.6)} />;
}
