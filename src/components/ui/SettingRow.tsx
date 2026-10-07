"use client";

import { Flex, Grid, Typography, theme } from "antd";
import { useId, type ReactNode } from "react";

interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Control debajo del texto a todo el ancho (ej. tarjetas de opciones). */
  stacked?: boolean;
  /** Sin separador inferior. */
  last?: boolean;
}

/** Fila de ajuste: control a la derecha en escritorio y debajo del texto en mobile. */
export function SettingRow({ label, description, children, stacked = false, last = false }: SettingRowProps) {
  const { token } = theme.useToken();
  const labelId = useId();
  const descriptionId = useId();
  const screens = Grid.useBreakpoint();
  const isStacked = stacked || !screens.md;

  return (
    <Flex
      role="group" aria-labelledby={labelId} aria-describedby={description ? descriptionId : undefined}
      vertical={isStacked}
      justify="space-between"
      align={isStacked ? "stretch" : "center"}
      gap={isStacked ? token.marginSM : token.margin}
      wrap
      style={{ paddingBlock: token.padding, borderBottom: last ? "none" : `1px solid ${token.colorBorderSecondary}` }}
    >
      <div style={{ minWidth: 0, flex: isStacked ? undefined : `1 1 ${token.controlHeight * 8}px` }}>
        <Typography.Text id={labelId} strong>{label}</Typography.Text>
        {description && (
          <Typography.Paragraph id={descriptionId} type="secondary" style={{ margin: 0, fontSize: token.fontSizeSM }}>
            {description}
          </Typography.Paragraph>
        )}
      </div>
      <div style={{ minWidth: 0, maxWidth: "100%", width: isStacked ? "100%" : undefined }}>{children}</div>
    </Flex>
  );
}
