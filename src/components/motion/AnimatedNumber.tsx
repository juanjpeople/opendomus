"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

const formatter = new Intl.NumberFormat("es-AR");

/**
 * Número que cuenta hasta su valor. Corre fuera de React (motion values):
 * no re-renderiza el componente en cada frame.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 90, damping: 20 });
  const text = useTransform(spring, (current) => formatter.format(Math.round(current)));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{text}</motion.span>;
}
