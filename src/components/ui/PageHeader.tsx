"use client";

import { Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Texto chico arriba del título (sección, fecha, contexto). */
  eyebrow?: ReactNode;
  /** Acciones a la derecha (botones, filtros). Como mucho dos visibles; el resto, en un Dropdown. */
  extra?: ReactNode;
  /** Identidad de la entidad a la izquierda del título (IconTile solid), en páginas de detalle. */
  leading?: ReactNode;
}

/** Encabezado estándar de toda página. Una sola por página. */
export function PageHeader({ title, description, eyebrow, extra, leading }: PageHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Reveal>
      <Flex justify="space-between" align="flex-end" gap={16} wrap style={{ marginBottom: 32 }}>
        <Flex align="center" gap={16} style={{ minWidth: 0 }}>
          {leading}
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
        </Flex>
        {extra && <Flex gap={8} wrap>{extra}</Flex>}
      </Flex>
    </Reveal>
  );
}
