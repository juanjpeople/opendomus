"use client";

import { Flex, Typography } from "antd";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Acciones a la derecha (botones, filtros). */
  extra?: ReactNode;
}

/** Encabezado estándar de toda página. Una sola por página. */
export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="flex-start" gap={16} wrap style={{ marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description && (
          <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0", fontSize: 16 }}>
            {description}
          </Typography.Paragraph>
        )}
      </div>
      {extra && <Flex gap={8} wrap>{extra}</Flex>}
    </Flex>
  );
}
