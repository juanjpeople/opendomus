"use client";

import { Flex, theme } from "antd";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { SPRING, TAP } from "@/lib/motion";

/** Filtros exclusivos visibles. Tab los recorre; Enter/Espacio activa una opción. */
export function FilterChips<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; color?: AppearanceColor; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const { token } = theme.useToken();
  return <Flex role="group" aria-label={label} wrap gap={token.marginXS}>
    {options.map((option) => {
      const palette = option.color ? tint(token, option.color) : { solid: token.colorPrimary, bg: token.colorPrimaryBg, border: token.colorPrimaryBorder };
      const selected = value === option.value;
      return <motion.button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)} className="od-focusable"
        whileHover={{ borderColor: palette.solid }} whileTap={{ scale: TAP.control }} transition={SPRING.snappy}
        style={{ "--od-ring": palette.solid, display: "inline-flex", alignItems: "center", gap: token.marginXS,
          minHeight: token.controlHeightLG + token.paddingXXS, maxWidth: "100%", padding: `${token.paddingXXS}px ${token.paddingSM}px`,
          border: `${token.lineWidth}px solid ${selected ? palette.solid : palette.border}`, borderRadius: token.borderRadiusLG,
          background: selected ? palette.bg : token.colorBgContainer, color: token.colorText,
          font: "inherit", fontSize: token.fontSizeSM, fontWeight: selected ? token.fontWeightStrong : undefined, cursor: "pointer", textAlign: "start",
        } as CSSProperties}>
        {option.icon && <span style={{ display: "inline-flex", color: palette.solid }}>{option.icon}</span>}{option.label}
      </motion.button>;
    })}
  </Flex>;
}
