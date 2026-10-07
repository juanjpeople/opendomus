"use client";

import { Flex, Typography, theme } from "antd";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AppearanceColor } from "@/lib/appearance";
import { IconTile } from "./IconTile";

interface SectionHeaderProps {
  title: ReactNode;
  /** Una línea de contexto (cantidades, estado). */
  description?: ReactNode;
  icon?: LucideIcon;
  color?: AppearanceColor;
  /** Acciones de la sección, a la derecha. */
  extra?: ReactNode;
}

/**
 * Encabezado de una sección dentro de una página (debajo del PageHeader). Uno solo por sección
 * y siempre este: nada de Card title en unas y Title sueltos en otras.
 */
export function SectionHeader({ title, description, icon, color, extra }: SectionHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 12 }}>
      <Flex align="center" gap={12} style={{ minWidth: 0 }}>
        {icon && <IconTile icon={icon} color={color} size={36} />}
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={4} style={{ margin: 0, letterSpacing: "-0.02em" }} ellipsis>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {description}
            </Typography.Text>
          )}
        </div>
      </Flex>
      {extra && (
        <Flex gap={8} wrap style={{ flexShrink: 0 }}>
          {extra}
        </Flex>
      )}
    </Flex>
  );
}
