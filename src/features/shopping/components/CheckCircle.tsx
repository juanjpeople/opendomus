"use client";

import { theme } from "antd";
import { motion } from "framer-motion";
import { SPRING } from "@/lib/motion";

interface CheckCircleProps {
  checked: boolean;
  onToggle?: () => void;
  label: string;
  size?: number;
}

/** Tilde redondo para la lista: se rellena y el check se dibuja al marcar. Área táctil de 44 px. */
export function CheckCircle({ checked, onToggle, label, size = 26 }: CheckCircleProps) {
  const { token } = theme.useToken();
  const disabled = !onToggle;

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      whileTap={disabled ? undefined : { scale: 0.85 }}
      whileHover={disabled ? undefined : { scale: 1.08 }}
      transition={SPRING.snappy}
      style={{
        all: "unset",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        margin: -9,
        cursor: disabled ? "default" : "pointer",
        borderRadius: "50%",
      }}
    >
      <motion.span
        initial={false}
        animate={{
          backgroundColor: checked ? token.colorSuccess : "rgba(0,0,0,0)",
          borderColor: checked ? token.colorSuccess : token.colorBorder,
          scale: checked ? [1, 1.18, 1] : 1,
        }}
        transition={{ duration: 0.28 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: "50%",
          borderWidth: 2,
          borderStyle: "solid",
          opacity: disabled && !checked ? 0.5 : 1,
        }}
      >
        <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke={token.colorTextLightSolid} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M5 12.5 L10 17.5 L19 7" initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: 0.25, delay: checked ? 0.08 : 0 }} />
        </svg>
      </motion.span>
    </motion.button>
  );
}
