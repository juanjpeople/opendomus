"use client";

import { Button, Card, Flex, Steps, theme } from "antd";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { DURATION, EASE_OUT } from "@/lib/motion";

type FlowAction = { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };

/**
 * Ancho estable; el dueño del flujo conserva borradores y decide qué pasos se pueden volver a abrir.
 * `secondary` es otra salida del paso (por ejemplo, empezar sin precarga): va junto a la principal.
 */
export function StepFlow({ steps = [], current = 0, screenKey, header, children, back, primary, secondary, footer, busy = false, framed = true }: {
  steps?: string[]; current?: number; screenKey: string; header?: ReactNode; children: ReactNode;
  back?: FlowAction; primary?: FlowAction; secondary?: FlowAction; footer?: ReactNode; busy?: boolean; framed?: boolean;
}) {
  const { token } = theme.useToken();
  const preference = usePreferences().motion;
  const systemReduced = useReducedMotion();
  const reduced = preference === "reduced" || (preference === "system" && systemReduced);
  const lastScreen = useRef(screenKey);
  const content = useRef<HTMLDivElement>(null);
  return <div style={{ width: "100%", maxWidth: token.screenMD, marginInline: "auto" }}>
    {steps.length > 1 && <Steps size="small" current={current} items={steps.map((title) => ({ title }))} style={{ marginBottom: token.marginLG }} />}
    <Card variant={framed ? "outlined" : "borderless"} style={framed ? undefined : { background: "transparent", boxShadow: "none" }} styles={{ body: { padding: framed ? token.paddingLG : 0 } }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={screenKey} ref={content} tabIndex={-1}
          initial={{ opacity: 0, y: reduced ? 0 : token.marginXS }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.base, ease: EASE_OUT }}
          onAnimationComplete={() => {
            if (lastScreen.current !== screenKey) { content.current?.focus({ preventScroll: true }); lastScreen.current = screenKey; }
          }}>
          <Screen>
            {header}
            {children}
            {(back || primary || secondary || footer) && <Flex wrap align="center" justify="space-between" gap={token.marginSM}>
              {back && <Button size="large" disabled={busy || primary?.loading || back.disabled} onClick={back.onClick}>{back.label}</Button>}
              {footer}
              {/* Volver queda a la izquierda. Si las dos salidas no entran en una fila, cada una ocupa el ancho. */}
              {(secondary || primary) && <Flex wrap justify="flex-end" gap={token.marginSM} style={{ marginInlineStart: "auto" }}>
                {secondary && <Button size="large" loading={secondary.loading} disabled={busy || secondary.disabled} onClick={secondary.onClick} style={{ flexGrow: 1 }}>{secondary.label}</Button>}
                {primary && <Button type="primary" size="large" loading={busy || primary.loading} disabled={busy || primary.disabled} onClick={primary.onClick} style={{ flexGrow: 1 }}>{primary.label}</Button>}
              </Flex>}
            </Flex>}
          </Screen>
        </motion.div>
      </AnimatePresence>
    </Card>
  </div>;
}

/** The screen that is leaving stays visible during its exit, but can no longer be clicked or focused. */
function Screen({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const present = useIsPresent();
  return <Flex vertical gap={token.marginLG} inert={!present}>{children}</Flex>;
}
