"use client";

import { Flex, Typography, theme } from "antd";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AppearanceColor } from "@/lib/appearance";
import { IconTile } from "./IconTile";

/** Encabezado de un panel o paso, con una sola jerarquía de título. */
export function PanelHeader({ icon, color, title, description, extra }: {
  icon?: LucideIcon; color?: AppearanceColor; title: ReactNode; description?: ReactNode; extra?: ReactNode;
}) {
  const { token } = theme.useToken();
  return <Flex align="center" gap={token.margin} wrap>
    {icon && <IconTile icon={icon} color={color} size={token.controlHeightLG} />}
    <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
      <Typography.Title level={3} style={{ margin: 0, letterSpacing: "-0.02em" }}>{title}</Typography.Title>
      {description && <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{description}</Typography.Paragraph>}
    </div>
    {extra}
  </Flex>;
}
