"use client";

import { Button, Flex, Popover, Typography, theme } from "antd";
import type { LucideIcon } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

/** Contexto persistente en la cabecera. El detalle se abre a pedido, también con teclado. */
export function ContextBadge({ icon: Icon, label, title, children }: {
  icon: LucideIcon; label: string; title: string; children: ReactNode;
}) {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  return <Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomRight" destroyOnHidden
    afterOpenChange={visible => { if (visible) content.current?.focus({ preventScroll: true }); }}
    content={<Flex ref={content} tabIndex={-1} id={id} vertical gap={token.margin} role="region" aria-label={title}
      style={{ width: token.controlHeight * 10, maxWidth: `calc(100vw - ${token.marginLG * 2}px)`, overflowWrap: "anywhere" }}
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <Typography.Text strong>{title}</Typography.Text>
      {children}
    </Flex>}>
    <Button ref={trigger} icon={<Icon />} aria-label={title} aria-expanded={open} aria-controls={open ? id : undefined}
      onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}
      style={{ minHeight: 44, color: token.colorInfoText, background: token.colorInfoBg, borderColor: token.colorInfoBorder }}>
      {label}
    </Button>
  </Popover>;
}
