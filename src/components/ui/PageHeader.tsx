"use client";

import { Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Texto chico arriba del título (sección, fecha, contexto). */
  eyebrow?: ReactNode;
  /** Ruta tocable arriba del título (PathCrumbs), en páginas anidadas. Reemplaza al eyebrow. */
  crumbs?: ReactNode;
  /** Acciones a la derecha (botones, filtros). Como mucho dos visibles; el resto, en un Dropdown. */
  extra?: ReactNode;
  /** Identidad de la entidad a la izquierda del título (IconTile solid), en páginas de detalle. */
  leading?: ReactNode;
}

/** Encabezado estándar de toda página. Una sola por página. */
export function PageHeader({ title, description, eyebrow, crumbs, extra, leading }: PageHeaderProps) {
  const { token } = theme.useToken();

  return (
    <Reveal>
      {crumbs && <div style={{ marginBottom: token.marginXS }}>{crumbs}</div>}
      <Flex justify="space-between" align="flex-end" gap={16} wrap style={{ marginBottom: 32 }}>
        <Flex align="center" gap={16} style={{ minWidth: 0 }}>
          {leading}
          <div style={{ minWidth: 0 }}>
            {eyebrow && !crumbs && (
              <Typography.Text
                strong
                style={{ color: token.colorTextSecondary, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: token.fontSizeSM }}
              >
                {eyebrow}
              </Typography.Text>
            )}
            <Typography.Title level={2} style={{ margin: eyebrow && !crumbs ? "4px 0 0" : 0, letterSpacing: "-0.025em", overflowWrap: "anywhere" }}>
              {title}
            </Typography.Title>
            {description && (
              <Typography.Paragraph type="secondary" style={{ margin: "6px 0 0", fontSize: token.fontSizeLG }}>
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
