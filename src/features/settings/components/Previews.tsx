"use client";

import { Button, Card, ConfigProvider, Flex, Segmented, Tag, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Plus, ShoppingCart } from "lucide-react";
import { useMemo } from "react";
import { SIDEBAR_WIDTH } from "@/components/layout/constants";
import { useIsDark } from "@/hooks/useIsDark";
import { usePreferences } from "@/hooks/usePreferences";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { DURATION, EASE_OUT, SPRING } from "@/lib/motion";
import { createTheme } from "@/lib/theme";
import { haloBackground, surfaceBackground } from "@/skins/surface";
import type { Skin } from "@/skins/types";
import { SkinContext, useSkin } from "@/skins/useSkin";
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

/** Mini pantalla de un skin: fondo, tarjeta con su sombra y radio, título con su tipografía y botón de marca. */
export function SkinPreview({ skin }: { skin: Skin }) {
  const isDark = useIsDark();
  const token = useMemo(
    () => theme.getDesignToken(createTheme({ brandColor: skin.brandColor, borderRadius: skin.borderRadius, fontSize: "md", density: "comfortable", motion: "system" }, isDark, skin)),
    [skin, isDark],
  );
  const line = (width: string) => <div style={{ height: 5, width, borderRadius: token.borderRadiusSM, background: token.colorFillSecondary, marginTop: 5 }} />;
  return (
    <div style={{ height: 72, padding: 10, background: token.colorBgLayout }}>
      <div
        style={{
          height: "100%",
          padding: 8,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          boxShadow: token.boxShadowTertiary,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: skin.headingFont ?? "inherit", fontWeight: 600, fontSize: token.fontSizeLG, lineHeight: 1, color: token.colorText }}>Aa</div>
          {line("80%")}
          {line("55%")}
        </div>
        <div style={{ width: 22, height: 22, borderRadius: token.borderRadius, background: token.colorPrimary }} />
      </div>
    </div>
  );
}

/**
 * Vista previa en vivo de un skin: piezas reales de antd pintadas con el tema que tendría la app
 * (con el tamaño de letra, la densidad y el modo claro u oscuro de la persona). No cambia nada
 * hasta que se elige.
 */
export function SkinLivePreview({ skin }: { skin: Skin }) {
  const isDark = useIsDark();
  const { fontSize, density, motion: motionPreference } = usePreferences();
  const config = useMemo(
    () => createTheme({ brandColor: skin.brandColor, borderRadius: skin.borderRadius, fontSize, density, motion: motionPreference }, isDark, skin),
    [skin, isDark, fontSize, density, motionPreference],
  );
  return (
    <ConfigProvider theme={config}>
      <SkinContext.Provider value={skin}>
        <LivePage />
      </SkinContext.Provider>
    </ConfigProvider>
  );
}

function LivePage() {
  const t = useT();
  const skin = useSkin();
  const { token } = theme.useToken();
  const green = tint(token, "green");
  const items = [
    { name: t("settings.appearance.livePreview.itemLow"), tag: t("settings.appearance.livePreview.low"), color: "warning" },
    { name: t("settings.appearance.livePreview.itemOk"), tag: t("settings.appearance.livePreview.ok"), color: "success" },
  ] as const;

  return (
    <motion.div
      key={skin.id}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.fast, ease: EASE_OUT }}
      style={{
        padding: token.paddingLG,
        borderRadius: token.borderRadiusLG,
        border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
        background: haloBackground(skin, `radial-gradient(ellipse 80% 55% at 70% 0%, ${token.colorPrimaryBg}, transparent 70%)`, token.colorBgLayout) ?? token.colorBgLayout,
        color: token.colorText,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {t("settings.appearance.livePreview.eyebrow")}
      </Typography.Text>
      <Typography.Title level={4} style={{ margin: 0, fontFamily: skin.headingFont ?? undefined }}>
        {t("settings.appearance.livePreview.title")}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: token.marginSM }}>
        {t("settings.appearance.livePreview.text")}
      </Typography.Paragraph>
      <Segmented
        size="small"
        options={[t("settings.appearance.livePreview.all"), t("settings.appearance.livePreview.missing")]}
        style={{ marginBottom: token.marginSM }}
      />
      <Card size="small" style={{ background: surfaceBackground(skin, green.bg, token.colorBgContainer, 70), marginBottom: token.marginSM }}>
        <Flex vertical gap={token.marginXS}>
          {items.map((item) => (
            <Flex key={item.name} align="center" justify="space-between" gap={token.marginXS}>
              <Typography.Text>{item.name}</Typography.Text>
              <Tag color={item.color} style={{ margin: 0 }}>{item.tag}</Tag>
            </Flex>
          ))}
        </Flex>
      </Card>
      <Flex gap={token.marginXS} wrap>
        <Button type="primary" icon={<Plus />}>{t("settings.appearance.livePreview.add")}</Button>
        <Button icon={<ShoppingCart />}>{t("settings.appearance.livePreview.list")}</Button>
      </Flex>
    </motion.div>
  );
}
