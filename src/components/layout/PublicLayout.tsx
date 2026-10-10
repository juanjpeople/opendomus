"use client";

import { haloBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { Flex, Typography, theme } from "antd";
import Link from "next/link";
import type { ReactNode } from "react";
import { HouseMark } from "@/components/illustrations/HouseMark";
import { useT } from "@/i18n";
import { LanguageSwitch, ThemeModeSwitch } from "./HeaderActions";

/** Marco de las páginas públicas (bienvenida, cuenta, invitación): logo, idioma, tema y un fondo suave. */
export function PublicLayout({ children, width = 1120 }: { children: ReactNode; width?: number }) {
  const t = useT();
  const { token } = theme.useToken();
  const skin = useSkin();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: haloBackground(skin, `radial-gradient(ellipse 70% 40% at 50% 0%, ${token.colorPrimaryBg}, transparent 70%)`, token.colorBgLayout),
      }}
    >
      <Flex wrap gap={12} align="center" justify="space-between" style={{ maxWidth: 1120, margin: "0 auto", padding: "16px 20px" }}>
        <Link href="/bienvenida" style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <HouseMark size={24} />
          <Typography.Text strong style={{ fontSize: token.fontSizeXL, color: token.colorPrimary, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {t("common.appName")}
          </Typography.Text>
        </Link>
        <Flex gap={8} align="center" style={{ flexShrink: 0, marginInlineStart: "auto" }}>
          <LanguageSwitch />
          <ThemeModeSwitch />
        </Flex>
      </Flex>
      <main style={{ maxWidth: width, margin: "0 auto", padding: "clamp(24px, 6vw, 56px) 20px 48px" }}>{children}</main>
    </div>
  );
}
