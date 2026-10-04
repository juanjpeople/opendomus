"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "@/lib/motion";

/** Transición entre páginas: el template se re-monta en cada navegación (el layout no). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}
