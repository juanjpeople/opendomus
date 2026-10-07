"use client";

import { Flex, Typography, theme } from "antd";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { IconTile } from "./IconTile";

/** Ayuda breve. `role="alert"` se reserva para errores que acaban de ocurrir. */
export function Callout({ tone = "neutral", title, children, icon, action, role = "note" }: {
  tone?: "neutral" | "primary" | "warning" | "danger";
  title?: ReactNode; children?: ReactNode; icon?: LucideIcon; action?: ReactNode; role?: "note" | "alert";
}) {
  const { token } = theme.useToken();
  const palette = {
    neutral: { background: token.colorFillQuaternary, border: token.colorBorderSecondary, color: "blue" as const },
    primary: { background: token.colorPrimaryBg, border: token.colorPrimaryBorder, color: "blue" as const },
    warning: { background: token.colorWarningBg, border: token.colorWarningBorder, color: "gold" as const },
    danger: { background: token.colorErrorBg, border: token.colorErrorBorder, color: "red" as const },
  }[tone];
  return <Flex role={role} gap={token.marginSM} align="flex-start" style={{ padding: token.padding, borderRadius: token.borderRadiusLG, background: palette.background, border: `1px solid ${palette.border}` }}>
    <IconTile icon={icon ?? (tone === "danger" || tone === "warning" ? TriangleAlert : Info)} color={palette.color} size={token.controlHeight} />
    <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
      {title && <Typography.Text strong>{title}</Typography.Text>}
      {children && <div style={{ color: token.colorTextSecondary }}>{children}</div>}
      {action && <div style={{ marginTop: token.marginSM }}>{action}</div>}
    </div>
  </Flex>;
}
