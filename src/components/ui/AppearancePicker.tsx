"use client";

import { Button, Flex, Tooltip, theme } from "antd";
import { motion } from "framer-motion";
import { Check, RotateCcw } from "lucide-react";
import { useT } from "@/i18n";
import { APPEARANCE_COLORS, APPEARANCE_ICONS, tint, type AppearanceColor, type AppearanceIcon } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";

interface ColorSwatchesProps {
  value?: AppearanceColor;
  /** Color que se usa si no hay uno elegido (el del tipo). */
  fallback: AppearanceColor;
  onChange?: (value: AppearanceColor | undefined) => void;
}

/** Muestras de color de la paleta (compatible con Form.Item). */
export function ColorSwatches({ value, fallback, onChange }: ColorSwatchesProps) {
  const { token } = theme.useToken();
  const t = useT();
  const current = value ?? fallback;

  return (
    <Flex gap={8} wrap align="center" role="radiogroup" aria-label={t("appearance.color")}>
      {APPEARANCE_COLORS.map((color) => {
        const selected = color === current;
        const { solid } = tint(token, color);
        return (
          <Tooltip key={color} title={t(`appearance.colors.${color}`)}>
            <motion.button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(`appearance.colors.${color}`)}
              onClick={() => onChange?.(color)}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              transition={SPRING.snappy}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: solid,
                color: token.colorTextLightSolid,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: selected ? `0 0 0 2px ${token.colorBgElevated}, 0 0 0 4px ${solid}` : "none",
              }}
            >
              {selected && <Check />}
            </motion.button>
          </Tooltip>
        );
      })}
      {value && (
        <Tooltip title={t("appearance.auto")}>
          <Button type="text" size="small" icon={<RotateCcw />} aria-label={t("appearance.auto")} onClick={() => onChange?.(undefined)} />
        </Tooltip>
      )}
    </Flex>
  );
}

interface IconGridProps {
  value?: AppearanceIcon;
  fallback: AppearanceIcon;
  /** Color con el que se resalta el ícono elegido. */
  color: AppearanceColor;
  onChange?: (value: AppearanceIcon | undefined) => void;
}

/** Grilla de íconos curados (compatible con Form.Item). */
export function IconGrid({ value, fallback, color, onChange }: IconGridProps) {
  const { token } = theme.useToken();
  const t = useT();
  const current = value ?? fallback;
  const palette = tint(token, color);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t("appearance.icon")}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))",
          gap: 4,
          maxHeight: 176,
          overflowY: "auto",
          padding: 6,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {(Object.keys(APPEARANCE_ICONS) as AppearanceIcon[]).map((key) => {
          const Icon = APPEARANCE_ICONS[key];
          const selected = key === current;
          return (
            <motion.button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={key}
              onClick={() => onChange?.(key)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={SPRING.snappy}
              style={{
                height: 38,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: token.fontSizeLG,
                cursor: "pointer",
                border: "none",
                borderRadius: token.borderRadius,
                background: selected ? palette.solid : "transparent",
                color: selected ? token.colorTextLightSolid : token.colorTextSecondary,
              }}
            >
              <Icon />
            </motion.button>
          );
        })}
      </div>
      {value && (
        <Button type="link" size="small" icon={<RotateCcw />} onClick={() => onChange?.(undefined)} style={{ paddingInline: 0, marginTop: 4 }}>
          {t("appearance.auto")}
        </Button>
      )}
    </div>
  );
}
