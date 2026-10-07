"use client";

import { Flex, Grid, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/motion";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "error";

interface StatTileProps {
  label: ReactNode;
  value: number;
  /** Formato del número (montos, porcentajes). Por defecto, el del idioma activo. */
  format?: (value: number) => string;
  /** Sustantivo al lado del número ("productos", "kg"). */
  suffix?: ReactNode;
  /** Color del punto: el estado que resume la cifra. */
  tone?: StatTone;
  /** Una línea de contexto debajo. */
  hint?: ReactNode;
}

/**
 * Cifra destacada de un resumen: punto de estado + etiqueta, número que cuenta hasta su valor
 * y contexto opcional. Se usan en fila (`Row gutter={[12, 12]}`), dentro de un `Stagger`.
 */
export function StatTile({ label, value, format, suffix, tone = "neutral", hint }: StatTileProps) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const dot = { neutral: token.colorTextQuaternary, primary: token.colorPrimary, success: token.colorSuccess, warning: token.colorWarning, error: token.colorError }[tone];

  return (
    <div
      style={{
        height: "100%",
        padding: screens.sm ? "14px 18px" : "12px 10px",
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
      }}
    >
      <Flex align="center" gap={8}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, minWidth: 0, overflowWrap: "anywhere" }}>
          {label}
        </Typography.Text>
      </Flex>
      <Flex align="baseline" gap={6} wrap>
        <Typography.Text style={{ fontSize: token.fontSizeHeading3, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.3 }}>
          <AnimatedNumber value={value} format={format} />
        </Typography.Text>
        {suffix && <Typography.Text type="secondary">{suffix}</Typography.Text>}
      </Flex>
      {hint && (
        <Typography.Text type="secondary" style={{ display: "block", fontSize: token.fontSizeSM }}>
          {hint}
        </Typography.Text>
      )}
    </div>
  );
}
