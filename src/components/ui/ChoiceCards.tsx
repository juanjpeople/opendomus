"use client";

import { Col, Flex, Row, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

export interface ChoiceOption<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  /** Mini vista previa de la opción (ej. cómo se ve el tema o el menú). */
  preview?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
}

type ChoiceCardsProps<T extends string> = {
  options: ChoiceOption<T>[];
  "aria-label": string;
  layout?: "grid" | "list";
  compact?: boolean;
  disabled?: boolean;
} & ({ multiple?: false; value: T; onChange: (value: T) => void } | { multiple: true; value: T[]; onChange: (value: T[]) => void });

/**
 * Elección entre pocas opciones con vista previa. Semántica de radio: flechas para moverse,
 * el borde de selección se desliza entre tarjetas (`layoutId`).
 */
export function ChoiceCards<T extends string>(props: ChoiceCardsProps<T>) {
  const { options, "aria-label": ariaLabel, layout = "grid", compact = false, disabled = false } = props;
  const { token } = theme.useToken();
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const firstEnabled = options.findIndex((option) => !option.disabled);
  const selectedIndex = props.multiple ? -1 : options.findIndex((option) => option.value === props.value && !option.disabled);

  function choose(value: T) {
    if (props.multiple) props.onChange(props.value.includes(value) ? props.value.filter((entry) => entry !== value) : [...props.value, value]);
    else props.onChange(value);
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step || props.multiple) return;
    event.preventDefault();
    for (let offset = 1; offset <= options.length; offset++) {
      const next = (index + step * offset + options.length) % options.length;
      if (!options[next].disabled) { choose(options[next].value); refs.current[next]?.focus(); break; }
    }
  }

  return (
    <Row gutter={[token.marginSM, token.marginSM]} role={props.multiple ? "group" : "radiogroup"} aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = props.multiple ? props.value.includes(option.value) : option.value === props.value;
        const unavailable = disabled || option.disabled;
        return (
          <Col key={option.value} xs={24} sm={layout === "list" ? 24 : 24 / Math.min(options.length, options.length > 3 ? 2 : 3)}>
            <motion.button
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              className="od-focusable"
              role={props.multiple ? "checkbox" : "radio"}
              disabled={unavailable}
              aria-checked={selected}
              aria-labelledby={`${groupId}-${index}-title`}
              aria-describedby={option.description ? `${groupId}-${index}-description` : undefined}
              tabIndex={props.multiple || index === (selectedIndex < 0 ? firstEnabled : selectedIndex) ? 0 : -1}
              onClick={() => choose(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              whileHover={unavailable ? undefined : { y: HOVER_LIFT.chip }}
              whileTap={unavailable ? undefined : { scale: TAP.card }}
              transition={SPRING.snappy}
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                padding: compact ? token.paddingSM : token.padding,
                textAlign: "start",
                cursor: unavailable ? "not-allowed" : "pointer",
                opacity: unavailable ? token.opacityLoading : 1,
                font: "inherit",
                color: token.colorText,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadiusLG,
              }}
            >
              {selected && (
                <motion.span
                  layoutId={props.multiple ? undefined : `choice-${groupId}`}
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
                  style={{ marginBottom: token.marginSM, borderRadius: token.borderRadius, overflow: "hidden", border: `1px solid ${token.colorBorderSecondary}` }}
                >
                  {option.preview}
                </div>
              )}
              <Flex align="center" justify="space-between" gap={token.marginSM}>
                {option.leading && <span aria-hidden style={{ display: "inline-flex", flexShrink: 0 }}>{option.leading}</span>}
                <div style={{ minWidth: 0, flex: 1, overflowWrap: "anywhere" }}>
                  <Typography.Text id={`${groupId}-${index}-title`} strong>{option.title}</Typography.Text>
                  {option.description && (
                    <Typography.Paragraph id={`${groupId}-${index}-description`} type="secondary" style={{ margin: 0, fontSize: token.fontSizeSM }}>
                      {option.description}
                    </Typography.Paragraph>
                  )}
                </div>
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                  transition={SPRING.snappy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: token.fontSizeXL,
                    height: token.fontSizeXL,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: token.colorPrimary,
                    color: token.colorTextLightSolid,
                    fontSize: token.fontSizeSM,
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
