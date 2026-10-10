"use client";

import type { ReactNode } from "react";
import { PageTransition } from "@/components/motion";

/** Transición entre páginas: el template se re-monta en cada navegación (el layout no). */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
