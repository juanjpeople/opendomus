"use client";

import { Button, Flex, InputNumber, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";

interface QuantityStepperProps {
  value: number;
  unit?: string;
  /** Se llama con +1 o -1. Sin onStep/onChange (o con readOnly), solo muestra el valor. */
  onStep?: (delta: 1 | -1) => void;
  /** Edición directa para precargas y cantidades grandes. */
  onChange?: (value: number) => void;
  "aria-label"?: string;
  disabled?: boolean;
  max?: number;
  precision?: number;
  readOnly?: boolean;
  min?: number;
}

/** Contador +/- para cantidades. El número se desliza hacia arriba al sumar y hacia abajo al restar. */
export function QuantityStepper({ value, unit, onStep, onChange, "aria-label": ariaLabel, disabled = false, max, precision, readOnly = !onStep && !onChange, min = 0 }: QuantityStepperProps) {
  const { token } = theme.useToken();
  const t = useT();
  // Dirección del último cambio, derivada en render (patrón "estado previo" de React, sin efectos).
  const [previous, setPrevious] = useState(value);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1);
    setPrevious(value);
  }

  return (
    <Flex
      role="group" aria-label={ariaLabel}
      align="center"
      style={{ background: token.colorFillTertiary, borderRadius: token.borderRadius, padding: token.paddingXXS }}
    >
      {!readOnly && (
        <Button
          type="text"
          size="small"
          aria-label={t("inventory.stepper.decrease")}
          icon={<Minus />}
          disabled={disabled || value <= min}
          onClick={() => onStep ? onStep(-1) : onChange?.(Math.max(min, value - 1))}
        />
      )}
      <Flex vertical align="center" style={{ minWidth: token.controlHeightLG, lineHeight: token.lineHeight }}>
        {onChange && !readOnly ? <InputNumber aria-label={ariaLabel} controls={false} variant="borderless" value={value} min={min} max={max} precision={precision} disabled={disabled} onChange={(next) => { if (next !== null) onChange(next); }} style={{ width: token.controlHeightLG * 2 }} /> : <span style={{ position: "relative", display: "inline-flex", overflow: "hidden" }}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.span
              key={value}
              custom={direction}
              variants={{
                enter: (dir: number) => ({ y: dir * token.fontSize, opacity: 0 }),
                center: { y: 0, opacity: 1 },
                exit: (dir: number) => ({ y: dir * -token.fontSize, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={SPRING.snappy}
              style={{ display: "inline-block" }}
            >
              <Typography.Text strong>{value}</Typography.Text>
            </motion.span>
          </AnimatePresence>
        </span>}
        {unit && (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM * 0.85, textTransform: "uppercase" }}>
            {unit}
          </Typography.Text>
        )}
      </Flex>
      {!readOnly && (
        <Button type="text" size="small" aria-label={t("inventory.stepper.increase")} icon={<Plus />} disabled={disabled || (max !== undefined && value >= max)} onClick={() => onStep ? onStep(1) : onChange?.(Math.min(max ?? Infinity, value + 1))} />
      )}
    </Flex>
  );
}
