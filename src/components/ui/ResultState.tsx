"use client";

import { Flex, Typography, theme } from "antd";
import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";
import { IconTile } from "./IconTile";

export function ResultState({ title, description, children, action }: {
  title: ReactNode; description?: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  const { token } = theme.useToken();
  return <Reveal><Flex vertical align="center" gap={token.margin} style={{ textAlign: "center", paddingBlock: token.paddingLG }}>
    <IconTile icon={CircleCheck} color="green" size={token.controlHeightLG * 1.5} />
    <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
    {description && <Typography.Paragraph type="secondary" style={{ margin: 0 }}>{description}</Typography.Paragraph>}
    {children}
    {action && <div style={{ width: "100%" }}>{action}</div>}
  </Flex></Reveal>;
}
