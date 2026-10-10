"use client";

import { Flex, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { DURATION, SPRING, STAGGER } from "@/lib/motion";

interface ListRowProps {
  /** Ícono o miniatura a la izquierda. Si una fila lo tiene, que lo tengan todas (con un respaldo genérico). */
  leading?: ReactNode;
  title: ReactNode;
  /** Anotaciones: conserva el texto completo en varias líneas. */
  wrapTitle?: boolean;
  /** Debajo del título: estado, mínimos, precio. */
  meta?: ReactNode;
  /** Controles a la derecha (stepper, consumir, borrar). Quedan fuera del botón principal. */
  trailing?: ReactNode;
  /** Abre el detalle. Toda la parte izquierda es el botón, con foco visible. */
  onOpen?: () => void;
  /** Para destinos navegables: conserva abrir en otra pestaña y copiar enlace. */
  href?: string;
  openLabel?: string;
  /** Posición en la lista: escalona la entrada (con tope, para que una lista larga no haga esperar). */
  index?: number;
  divider?: boolean;
  /** Resalta la fila a la que se llegó desde otra pantalla (búsqueda, aviso). */
  highlighted?: boolean;
  /** Ancla para llevar la fila a la vista. */
  id?: string;
}

/**
 * Fila de una lista dentro de una Card sin padding (`styles={{ body: { padding: 0 } }}`).
 * Entra deslizándose, sale hacia el otro lado: usarla dentro de `<AnimatePresence>`.
 */
export function ListRow({ leading, title, wrapTitle = false, meta, trailing, onOpen, href, openLabel, index = 0, divider = true, highlighted = false, id }: ListRowProps) {
  const { token } = theme.useToken();

  const main = (
    <Flex align="center" gap={12} style={{ minWidth: 0 }}>
      {leading}
      <Flex vertical gap={4} style={{ minWidth: 0 }}>
        <Flex align="center" gap={4} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis={!wrapTitle} style={wrapTitle ? { overflowWrap: "anywhere" } : undefined}>
            {title}
          </Typography.Text>
          {(onOpen || href) && (
            <Typography.Text type="secondary" style={{ display: "inline-flex" }}>
              <ChevronRight />
            </Typography.Text>
          )}
        </Flex>
        {meta && (
          <Flex gap={8} align="center" wrap style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
            {meta}
          </Flex>
        )}
      </Flex>
    </Flex>
  );

  const openStyle: CSSProperties & Record<"--od-ring", string> = {
    "--od-ring": token.colorPrimary,
    minWidth: 0,
    flex: "1 1 160px",
    padding: 0,
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    background: "none",
    border: "none",
    borderRadius: token.borderRadius,
    cursor: "pointer",
  };

  return (
    <motion.div
      id={id}
      layout
      initial={{ opacity: 0, x: -token.margin }}
      animate={{ opacity: 1, x: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * (STAGGER / 2) } }}
      exit={{ opacity: 0, x: token.margin, transition: { duration: DURATION.fast } }}
      whileHover={{ backgroundColor: token.colorFillQuaternary, transition: { duration: DURATION.fast } }}
      // Transparente como rgba (no "transparent"): framer necesita un color para interpolar el hover.
      style={{
        borderBottom: divider ? `1px solid ${token.colorBorderSecondary}` : undefined,
        backgroundColor: highlighted ? token.colorPrimaryBg : "rgba(0, 0, 0, 0)",
        boxShadow: highlighted ? `inset 3px 0 0 ${token.colorPrimary}` : undefined,
      }}
    >
      <Flex justify="space-between" align="center" gap={16} wrap style={{ padding: `${token.paddingSM}px ${token.paddingLG}px` }}>
        {href ? <Link href={href} aria-label={openLabel} className="od-focusable" style={openStyle}>{main}</Link> : onOpen ? (
          <button type="button" onClick={onOpen} aria-label={openLabel} className="od-focusable" style={openStyle}>
            {main}
          </button>
        ) : (
          <div style={{ minWidth: 0, flex: "1 1 160px" }}>{main}</div>
        )}
        {trailing && (
          <Flex align="center" gap={8}>
            {trailing}
          </Flex>
        )}
      </Flex>
    </motion.div>
  );
}
