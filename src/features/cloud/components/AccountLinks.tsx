"use client";

import { Flex, Typography } from "antd";
import Link from "next/link";
import { useT } from "@/i18n";
import { CLOUD_ENABLED } from "@/lib/cloud/api";

/** La cuenta es independiente de la licencia necesaria para crear una casa. */
export function AccountLinks() {
  const t = useT();
  if (!CLOUD_ENABLED) return null;
  const linkStyle = { display: "inline-flex", alignItems: "center", minHeight: 44 };
  return (
    <Flex vertical align="center" gap={8} style={{ margin: "24px auto", maxWidth: 720, paddingInline: 16, textAlign: "center" }}>
      <Typography.Text type="secondary">{t("cloud.entry.description")}</Typography.Text>
      <Flex justify="center" gap={20} wrap>
        <Link style={linkStyle} href="/cuenta?modo=entrar">{t("cloud.auth.signInTab")}</Link>
        <Link style={linkStyle} href="/cuenta?modo=crear">{t("cloud.auth.createTab")}</Link>
        <Link style={linkStyle} href="/cuenta?modo=recuperar">{t("cloud.recover.title")}</Link>
      </Flex>
    </Flex>
  );
}
