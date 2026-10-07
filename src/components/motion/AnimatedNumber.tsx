"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { useI18n } from "@/i18n";

/**
 * Número que cuenta hasta su valor. Corre fuera de React (motion values):
 * no re-renderiza el componente en cada frame. Por defecto usa el formato del idioma activo;
 * `format` permite otro (montos, porcentajes).
 */
export function AnimatedNumber({ value, format }: { value: number; format?: (value: number) => string }) {
  const { format: formatters } = useI18n();
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const text = useTransform(spring, (current) => (format ?? formatters.number)(Math.round(current)));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{text}</motion.span>;
}
