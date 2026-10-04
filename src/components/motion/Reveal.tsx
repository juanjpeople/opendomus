"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { DURATION, EASE_OUT } from "@/lib/motion";

interface RevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  /** Desplazamiento inicial en px. */
  y?: number;
  /** `true`: aparece al entrar en pantalla (una sola vez). `false`: al montarse. */
  inView?: boolean;
}

/** Entrada con fade + subida. La animación de base de toda la app. */
export function Reveal({ delay = 0, y = 12, inView = false, children, ...rest }: RevealProps) {
  const visible = { opacity: 1, y: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      {...(inView ? { whileInView: visible, viewport: { once: true, amount: 0.3 } } : { animate: visible })}
      transition={{ duration: DURATION.base, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
