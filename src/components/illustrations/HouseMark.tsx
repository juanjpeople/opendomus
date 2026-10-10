"use client";

import { useSkin } from "@/skins/useSkin";
import { theme } from "antd";
import { motion } from "framer-motion";

interface HouseMarkProps {
  /** Tamaño en px o cualquier unidad CSS. Por defecto sigue al texto. */
  size?: number | string;
  /** Se dibuja y borra en loop (para estados de carga). */
  loading?: boolean;
}

/** Isotipo de OpenDomus: la casa del hero, mínima. Se dibuja al montarse. */
export function HouseMark({ size = "1em", loading = false }: HouseMarkProps) {
  const { token } = theme.useToken();
  const { illustration } = useSkin();

  const draw = (delay: number) =>
    loading
      ? {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.9, delay, repeat: Infinity, repeatType: "reverse" as const, ease: "easeInOut" as const },
        }
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.6, delay, ease: "easeInOut" as const },
        };

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={token.colorPrimary}
      strokeWidth={illustration.stroke}
      strokeLinecap={illustration.rounded ? "round" : "square"}
      strokeLinejoin={illustration.rounded ? "round" : "miter"}
      aria-hidden
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      <motion.path d="M5 10.5 V20 H19 V10.5" {...draw(0)} />
      <motion.path d="M3 11.5 L12 4 L21 11.5" {...draw(0.25)} />
      <motion.rect
        x={10}
        y={13.5}
        width={4}
        height={4}
        rx={1}
        stroke="none"
        fill={token.colorWarning}
        initial={{ opacity: 0 }}
        animate={{ opacity: loading ? [0.2, 1, 0.2] : 1 }}
        transition={loading ? { duration: 1.8, repeat: Infinity } : { delay: 0.6, duration: 0.4 }}
      />
    </svg>
  );
}
