"use client";

import { Button, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

interface VisualTileProps {
  /** Ilustración arriba: escena del contenedor, IconTile, foto. */
  media?: ReactNode;
  title: ReactNode;
  /** Una línea secundaria (tipo, cantidades). Más detalle va en la página de destino, no acá. */
  meta?: ReactNode;
  /** Pie opcional (barra de stock, etiquetas). */
  footer?: ReactNode;
  /** Navega (Link) o actúa (botón). Sin ninguno, la ficha es solo visual. */
  href?: string;
  onClick?: () => void;
  /** Color de la entidad: borde al pasar el mouse, anillo de foco y fondo si está elegida. */
  color?: AppearanceColor;
  selected?: boolean;
  /** Acción de esquina (imprimir etiqueta, favorito). Siempre 44px y con nombre accesible. */
  action?: { icon: ReactNode; label: string; onClick: () => void };
}

/**
 * Ficha visual de una entidad (contenedor, producto del catálogo, resultado de búsqueda):
 * se eleva con resorte, el borde toma el color de la entidad y la ilustración se acerca apenas.
 */
export function VisualTile({ media, title, meta, footer, href, onClick, color, selected = false, action }: VisualTileProps) {
  const { token } = theme.useToken();
  const accent = color ? tint(token, color) : { solid: token.colorPrimary, bg: token.colorPrimaryBg };
  const interactive = !!href || !!onClick;

  const body = (
    <motion.div
      variants={{ rest: { borderColor: selected ? accent.solid : token.colorBorderSecondary }, hover: { borderColor: accent.solid } }}
      transition={SPRING.snappy}
      style={{
        height: "100%",
        padding: 12,
        borderRadius: token.borderRadiusLG,
        // Propiedades separadas (no el atajo `border`): el color se anima.
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: selected ? accent.solid : token.colorBorderSecondary,
        background: selected ? accent.bg : token.colorBgContainer,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      {media && (
        <div style={{ overflow: "hidden", borderRadius: token.borderRadius, marginBottom: 10 }}>
          <motion.div variants={{ hover: { scale: 1.04 } }} transition={{ duration: 0.4 }}>
            {media}
          </motion.div>
        </div>
      )}
      <Typography.Text strong ellipsis={{ tooltip: title }} style={{ display: "block", paddingInlineEnd: action && !media ? 44 : 0 }}>
        {title}
      </Typography.Text>
      {meta && (
        <Typography.Text type="secondary" ellipsis={{ tooltip: meta }} style={{ display: "block", fontSize: token.fontSizeSM }}>
          {meta}
        </Typography.Text>
      )}
      {footer}
    </motion.div>
  );

  const shell: CSSProperties & Record<"--od-ring", string> = {
    "--od-ring": accent.solid,
    display: "block",
    width: "100%",
    height: "100%",
    padding: 0,
    color: "inherit",
    font: "inherit",
    textAlign: "start",
    background: "none",
    border: "none",
    borderRadius: token.borderRadiusLG,
    cursor: interactive ? "pointer" : "default",
  };

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover={interactive ? "hover" : undefined}
      whileTap={interactive ? { scale: TAP.card } : undefined}
      variants={{ rest: { y: 0 }, hover: { y: HOVER_LIFT.card } }}
      transition={SPRING.snappy}
      style={{ position: "relative", height: "100%" }}
    >
      {href ? (
        <Link href={href} className="od-focusable" style={shell}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected || undefined} className="od-focusable" style={shell}>
          {body}
        </button>
      ) : (
        <div style={shell}>{body}</div>
      )}
      {action && (
        <Tooltip title={action.label}>
          <Button
            type="text"
            icon={action.icon}
            aria-label={action.label}
            onClick={action.onClick}
            // Vidrio, como la cabecera: no tapa la ilustración de abajo.
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 44,
              height: 44,
              color: token.colorText,
              borderRadius: token.borderRadius,
              backdropFilter: "blur(6px)",
              background: `color-mix(in srgb, ${token.colorBgContainer} 60%, transparent)`,
            }}
          />
        </Tooltip>
      )}
    </motion.div>
  );
}
