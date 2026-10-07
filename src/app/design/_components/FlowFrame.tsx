"use client";

import { Flex, Grid, Segmented, Tag, Tooltip, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Compass } from "lucide-react";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "@/lib/motion";

interface FlowFrameProps<T extends string> {
  steps: { value: T; label: string }[];
  step: T;
  onStep: (step: T) => void;
  /** adoptado: la pantalla real ya se ve así · referencia: es el objetivo, la pantalla real falta migrar. */
  status: "adopted" | "reference";
  /** Cambia la pantalla (y repite la transición) aunque el paso sea el mismo: otro contenedor, otra receta. */
  screenKey?: string;
  children: ReactNode;
}

/**
 * Una "pantalla" de la app dentro de /design: mismo fondo con brillo de marca que AppShell,
 * pasos navegables y la misma transición de página que template.tsx.
 */
export function FlowFrame<T extends string>({ steps, step, onStep, status, screenKey, children }: FlowFrameProps<T>) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();

  return (
    <div>
      <Flex justify="space-between" align="center" gap={12} wrap style={{ marginBottom: 12 }}>
        <Segmented<T> value={step} onChange={onStep} options={steps} />
        {status === "adopted" ? (
          <Tag color="success" variant="filled" icon={<CircleCheck />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            Así se ve hoy en la app
          </Tag>
        ) : (
          <Tooltip title="Es el objetivo. La pantalla real todavía no se migró: ver docs/UNIFICACION_VISUAL.md.">
            <Tag color="gold" variant="filled" icon={<Compass />} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
              Referencia: falta migrar la pantalla real
            </Tag>
          </Tooltip>
        )}
      </Flex>
      <div
        style={{
          minHeight: 520,
          padding: screens.md ? "32px 24px" : "24px 16px",
          borderRadius: token.borderRadiusLG * 1.5,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: `radial-gradient(ellipse 70% 40% at 60% -5%, ${token.colorPrimaryBg}, transparent 70%), ${token.colorBgLayout}`,
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey ?? step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
