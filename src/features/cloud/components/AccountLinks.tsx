"use client";
import { useHydrated } from "@/hooks/useHydrated";

import { Flex, Typography, theme } from "antd";
import { Reveal } from "@/components/motion";
import { SectionTitle } from "@/components/ui";
import Link from "next/link";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";

/** La cuenta es independiente de la licencia necesaria para crear una casa. */
export function AccountLinks({ editorial = false }: { editorial?: boolean }) {
  const { token } = theme.useToken();
  const t = useT();
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (!CLOUD_ENABLED) return null;
  const linkStyle = { display: "inline-flex", alignItems: "center", minHeight: 44 };
  return (
    <Reveal inView={editorial} style={{ margin: `${token.marginXL}px auto`, maxWidth: editorial ? 1160 : 720, paddingInline: token.paddingLG }}>
    {editorial && <SectionTitle eyebrow={t("cloud.auth.signInTab")} title={t("cloud.entry.title")} description={t("cloud.entry.description")} />}
    <Flex vertical align={editorial ? "flex-start" : "center"} gap={token.marginXS}>
      {!editorial && <Typography.Text type="secondary">{t("cloud.entry.description")}</Typography.Text>}
      <Flex gap={token.marginLG} wrap>
        <Link style={linkStyle} href="/cuenta?modo=entrar">{t("cloud.auth.signInTab")}</Link>
        <Link style={linkStyle} href="/cuenta?modo=crear">{t("cloud.auth.createTab")}</Link>
        <Link style={linkStyle} href="/unirme">{t("cloud.entry.invited")}</Link>
        <Link style={linkStyle} href="/cuenta?modo=recuperar">{t("cloud.recover.title")}</Link>
      </Flex>
    </Flex></Reveal>
  );
}
