"use client";

import { Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Texto chico arriba del título (sección, fecha, contexto). */
  eyebrow?: ReactNode;
  /** Acciones a la derecha (botones, filtros). */
  extra?: ReactNode;
}

/** Encabezado estándar de toda página. Una sola por página. */
export function PageHeader({ title, description, eyebrow, extra }: PageHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Reveal>
      <Flex justify="space-between" align="flex-end" gap={16} wrap style={{ marginBottom: 32 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography.Text
              strong
              style={{ color: token.colorPrimary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12 }}
            >
              {eyebrow}
            </Typography.Text>
          )}
          <Typography.Title level={2} style={{ margin: eyebrow ? "4px 0 0" : 0, letterSpacing: "-0.025em" }}>
            {title}
          </Typography.Title>
          {description && (
            <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0", fontSize: 16 }}>
              {description}
            </Typography.Paragraph>
          )}
        </div>
        {extra && <Flex gap={8} wrap>{extra}</Flex>}
      </Flex>
    </Reveal>
  );
}
