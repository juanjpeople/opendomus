"use client";

import { Col, Flex, Row, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { SPRING } from "@/lib/motion";

export interface ChoiceOption<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  /** Mini vista previa de la opción (ej. cómo se ve el tema o el menú). */
  preview?: ReactNode;
}

interface ChoiceCardsProps<T extends string> {
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  "aria-label": string;
}

/**
 * Elección entre pocas opciones con vista previa. Semántica de radio: flechas para moverse,
 * el borde de selección se desliza entre tarjetas (`layoutId`).
 */
export function ChoiceCards<T extends string>({ value, options, onChange, "aria-label": ariaLabel }: ChoiceCardsProps<T>) {
  const { token } = theme.useToken();
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <Row gutter={[12, 12]} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Col key={option.value} xs={24} sm={24 / options.length}>
            <motion.button
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                padding: 12,
                textAlign: "start",
                cursor: "pointer",
                font: "inherit",
                color: token.colorText,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
              }}
            >
              {selected && (
                <motion.span
                  layoutId={`choice-${groupId}`}
                  transition={SPRING.snappy}
                  style={{
                    position: "absolute",
                    inset: -1,
                    borderRadius: token.borderRadiusLG,
                    border: `2px solid ${token.colorPrimary}`,
                    pointerEvents: "none",
                  }}
                />
              )}
              {option.preview && (
                <div
                  aria-hidden
                  style={{ marginBottom: 10, borderRadius: token.borderRadius, overflow: "hidden", border: `1px solid ${token.colorBorderSecondary}` }}
                >
                  {option.preview}
                </div>
              )}
              <Flex align="flex-start" justify="space-between" gap={8}>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong>{option.title}</Typography.Text>
                  {option.description && (
                    <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: token.fontSizeSM }}>
                      {option.description}
                    </Typography.Paragraph>
                  )}
                </div>
                <motion.span
                  initial={false}
                  animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                  transition={SPRING.snappy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: token.colorPrimary,
                    color: token.colorTextLightSolid,
                    fontSize: 12,
                  }}
                >
                  <Check />
                </motion.span>
              </Flex>
            </motion.button>
          </Col>
        );
      })}
    </Row>
  );
}
