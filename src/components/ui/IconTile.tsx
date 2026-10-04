"use client";

import { theme } from "antd";
import type { LucideIcon } from "lucide-react";
import { tint, type AppearanceColor } from "@/lib/appearance";

interface IconTileProps {
  icon: LucideIcon;
  /** Lado del recuadro en px. El ícono ocupa la mitad. */
  size?: number;
  /** Relleno sólido (estado activo/destacado). */
  solid?: boolean;
  /** Color propio (recintos, contenedores…). Por defecto, el color de marca. */
  color?: AppearanceColor;
}

/** Ícono dentro de un recuadro de color. Encabeza tarjetas y estados. */
export function IconTile({ icon: Icon, size = 48, solid = false, color }: IconTileProps) {
  const { token } = theme.useToken();
  const palette = color ? tint(token, color) : { bg: token.colorPrimaryBg, solid: token.colorPrimary };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: token.borderRadiusLG,
        background: solid ? palette.solid : palette.bg,
        color: solid ? token.colorTextLightSolid : palette.solid,
        fontSize: size / 2,
        transition: "background 0.3s, color 0.3s",
      }}
    >
      <Icon />
    </span>
  );
}
