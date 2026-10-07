"use client";

import { Flex, Typography, theme } from "antd";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";

export function TrustNote({ children }: { children?: ReactNode }) {
  const { token } = theme.useToken();
  const t = useT();
  return <Flex align="flex-start" justify="center" gap={token.marginXS}>
    <span aria-hidden style={{ display: "inline-flex", color: token.colorSuccess, paddingTop: token.paddingXXS }}><ShieldCheck /></span>
    <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{children ?? t("cloud.auth.e2ee")}</Typography.Text>
  </Flex>;
}
