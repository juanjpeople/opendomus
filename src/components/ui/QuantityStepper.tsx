"use client";

import { Button, Flex, Typography, theme } from "antd";
import { Minus, Plus } from "lucide-react";

interface QuantityStepperProps {
  value: number;
  unit?: string;
  /** Se llama con +1 o -1. Si se omite (o `readOnly`), solo muestra el valor. */
  onStep?: (delta: 1 | -1) => void;
  readOnly?: boolean;
  min?: number;
}

/** Contador +/- para cantidades. */
export function QuantityStepper({ value, unit, onStep, readOnly = !onStep, min = 0 }: QuantityStepperProps) {
  const { token } = theme.useToken();

  return (
    <Flex
      align="center"
      style={{ background: token.colorFillTertiary, borderRadius: token.borderRadius, padding: 4 }}
    >
      {!readOnly && (
        <Button
          type="text"
          size="small"
          aria-label="Restar uno"
          icon={<Minus />}
          disabled={value <= min}
          onClick={() => onStep?.(-1)}
        />
      )}
      <Flex vertical align="center" style={{ minWidth: 56, lineHeight: 1.2 }}>
        <Typography.Text strong>{value}</Typography.Text>
        {unit && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM * 0.85, textTransform: "uppercase" }}>
            {unit}
          </Typography.Text>
        )}
      </Flex>
      {!readOnly && (
        <Button type="text" size="small" aria-label="Sumar uno" icon={<Plus />} onClick={() => onStep?.(1)} />
      )}
    </Flex>
  );
}
