"use client";

import { theme } from "antd";
import { motion } from "framer-motion";

export type PulseTone = "success" | "warning" | "error" | "primary";

/** Punto de estado "vivo": late con una onda que se expande. Para algo que está pasando ahora. */
export function PulseDot({ tone = "success", size = 10 }: { tone?: PulseTone; size?: number }) {
  const { token } = theme.useToken();
  const color = { success: token.colorSuccess, warning: token.colorWarning, error: token.colorError, primary: token.colorPrimary }[tone];

  return (
    <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <motion.span
        animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }}
      />
      <span style={{ position: "relative", width: size, height: size, borderRadius: "50%", background: color }} />
    </span>
  );
}
