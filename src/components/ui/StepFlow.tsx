"use client";

import { Button, Card, Flex, Steps, theme } from "antd";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { DURATION, EASE_OUT } from "@/lib/motion";

type FlowAction = { label: string; onClick: () => void; disabled?: boolean; loading?: boolean };

/** Ancho estable; el dueño del flujo conserva borradores y decide qué pasos se pueden volver a abrir. */
export function StepFlow({ steps = [], current = 0, screenKey, header, children, back, primary, footer, busy = false, framed = true }: {
  steps?: string[]; current?: number; screenKey: string; header?: ReactNode; children: ReactNode;
  back?: FlowAction; primary?: FlowAction; footer?: ReactNode; busy?: boolean; framed?: boolean;
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
          <Flex vertical gap={token.marginLG}>
            {header}
            {children}
            {(back || primary || footer) && <Flex wrap align="center" justify="space-between" gap={token.marginSM}>
              {back && <Button size="large" disabled={busy || primary?.loading || back.disabled} onClick={back.onClick}>{back.label}</Button>}
              {footer}
              {primary && <Button type="primary" size="large" loading={busy || primary.loading} disabled={busy || primary.disabled} onClick={primary.onClick} style={{ marginInlineStart: "auto" }}>{primary.label}</Button>}
            </Flex>}
          </Flex>
        </motion.div>
      </AnimatePresence>
    </Card>
  </div>;
}
