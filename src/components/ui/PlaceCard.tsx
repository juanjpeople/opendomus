"use client";

import { surfaceBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { Flex, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { IconTile } from "./IconTile";
import { RoomFloor, type FloorPattern } from "./RoomFloor";

export interface PlaceShortcut {
  key: string;
  href: string;
  /** Lo que se lee en el mueble. */
  name: string;
  /** Nombre accesible y tooltip: el nombre y, si hace falta, su estado ("Alacena · 2 para reponer"). */
  label: string;
  icon: LucideIcon;
  color?: AppearanceColor;
  /** Marca el acceso con un punto de alerta. */
  alert?: boolean;
}

interface PlaceCardProps {
  /** Página del lugar. */
  href: string;
  title: string;
  icon: LucideIcon;
  color: AppearanceColor;
  /** Una línea de resumen ("4 contenedores · 17 productos"). */
  meta?: ReactNode;
  /** Pie con estado: lo que necesita atención o que está todo bien. */
  status?: { tone: "success" | "warning"; text: ReactNode };
  floor?: FloorPattern;
  /** Mini plano: un acceso por mueble (ícono y nombre, 44 px de alto). Conviene no pasar de seis. */
  shortcuts?: PlaceShortcut[];
  /** Lo que no entra en el mini plano: "+3" lleva al lugar. */
  more?: { count: number; label: string };
  /** Se muestra sobre el piso cuando no hay accesos. */
  empty?: ReactNode;
}

/**
 * Tarjeta de un lugar de la casa con su mini plano. El encabezado abre el lugar; cada mueble del
 * plano abre ese mueble. La tarjeta sube con resorte y el borde toma el color del lugar.
 */
export function PlaceCard({ href, title, icon, color, meta, status, floor = "dots", shortcuts = [], more, empty }: PlaceCardProps) {
  const { token } = theme.useToken();
  const skin = useSkin();
  const palette = tint(token, color);
  const glyph = token.controlHeightLG + token.paddingXXS;

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={{ scale: TAP.card }}
      variants={{ rest: { y: 0, borderColor: palette.border }, hover: { y: HOVER_LIFT.card, borderColor: palette.solid } }}
      transition={SPRING.snappy}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: token.marginSM,
        padding: token.padding,
        borderRadius: token.borderRadiusLG * 2,
        borderWidth: token.lineWidth,
        borderStyle: "solid",
        borderColor: palette.border,
        background: surfaceBackground(skin, palette.bg, token.colorBgContainer, 60),
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Link href={href} className="od-focusable" style={{ "--od-ring": palette.solid, color: "inherit", borderRadius: token.borderRadiusLG } as CSSProperties}>
        <Flex align="center" gap={token.marginSM}>
          <IconTile icon={icon} color={color} size={glyph} solid />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Title level={4} style={{ margin: 0, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>
              {title}
            </Typography.Title>
            {meta && (
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {meta}
              </Typography.Text>
            )}
          </div>
          <motion.span variants={{ rest: { x: 0 }, hover: { x: -HOVER_LIFT.chip } }} transition={SPRING.snappy} style={{ display: "inline-flex", color: palette.solid, fontSize: token.fontSizeLG }}>
            <ChevronRight />
          </motion.span>
        </Flex>
      </Link>

      <RoomFloor pattern={floor} color={color} minTileWidth={token.controlHeightLG * 3}>
        {shortcuts.map((shortcut) => {
          const tone = shortcut.color ? tint(token, shortcut.color) : palette;
          return (
            <Tooltip key={shortcut.key} title={shortcut.label}>
              <motion.span whileHover={{ y: HOVER_LIFT.chip }} whileTap={{ scale: TAP.control }} transition={SPRING.snappy} style={{ display: "block", position: "relative" }}>
                <Link
                  href={shortcut.href}
                  aria-label={shortcut.label}
                  className="od-focusable"
                  style={{
                    "--od-ring": tone.solid,
                    display: "flex",
                    alignItems: "center",
                    gap: token.marginXS,
                    minHeight: glyph,
                    padding: `${token.paddingXXS}px ${token.paddingSM}px`,
                    borderRadius: token.borderRadiusLG,
                    border: `${token.lineWidth}px solid ${tone.border}`,
                    background: token.colorBgContainer,
                    color: token.colorText,
                    fontSize: token.fontSizeSM,
                    boxShadow: token.boxShadowTertiary,
                  } as CSSProperties}
                >
                  <span style={{ display: "inline-flex", color: tone.solid, fontSize: token.fontSizeLG }}>
                    <shortcut.icon />
                  </span>
                  {/* Hasta dos líneas: "Papelería compartida" se lee entera. */}
                  <span style={{ minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.25 }}>{shortcut.name}</span>
                </Link>
                {shortcut.alert && (
                  <span aria-hidden style={{ position: "absolute", top: -token.paddingXXS, right: -token.paddingXXS, width: token.paddingSM, height: token.paddingSM, borderRadius: "50%", background: token.colorWarning, border: `2px solid ${token.colorBgContainer}` }} />
                )}
              </motion.span>
            </Tooltip>
          );
        })}
        {more && more.count > 0 && (
          <Link
            href={href}
            aria-label={more.label}
            className="od-focusable"
            style={{ "--od-ring": palette.solid, display: "flex", alignItems: "center", justifyContent: "center", minHeight: glyph, borderRadius: token.borderRadiusLG, border: `${token.lineWidth}px dashed ${palette.border}`, color: palette.text, fontWeight: token.fontWeightStrong } as CSSProperties}
          >
            +{more.count}
          </Link>
        )}
        {shortcuts.length === 0 && empty && (
          <Typography.Text type="secondary" style={{ gridColumn: "1 / -1", padding: token.paddingXXS, fontSize: token.fontSizeSM }}>
            {empty}
          </Typography.Text>
        )}
      </RoomFloor>

      {status && (
        <Flex align="center" gap={token.marginXS} style={{ marginTop: "auto" }}>
          <span aria-hidden style={{ width: token.marginXS, height: token.marginXS, borderRadius: "50%", flexShrink: 0, background: status.tone === "warning" ? token.colorWarning : token.colorSuccess }} />
          <Typography.Text type={status.tone === "warning" ? undefined : "secondary"} style={{ fontSize: token.fontSizeSM, color: status.tone === "warning" ? token.colorWarningText : undefined }}>
            {status.text}
          </Typography.Text>
        </Flex>
      )}
    </motion.div>
  );
}
