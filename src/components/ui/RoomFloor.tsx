"use client";

import { theme } from "antd";
import type { ReactNode } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";

/** Textura del piso: puntos (genérico), baldosas (cocina, baño), tablas (dormitorio, living), diagonales (jardín). */
export type FloorPattern = "dots" | "tiles" | "boards" | "diagonal";

interface RoomFloorProps {
  pattern?: FloorPattern;
  /** Color del ambiente: tiñe las líneas del piso. */
  color?: AppearanceColor;
  /** Ancho mínimo de cada ficha. Con el valor por defecto entran dos por fila en un celular. */
  minTileWidth?: number;
  children: ReactNode;
}

function background(pattern: FloorPattern, line: string) {
  switch (pattern) {
    case "tiles":
      return { backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: "32px 32px" };
    case "boards":
      return { backgroundImage: `repeating-linear-gradient(0deg, transparent 0 25px, ${line} 25px 26px)` };
    case "diagonal":
      return { backgroundImage: `repeating-linear-gradient(120deg, transparent 0 18px, ${line} 18px 19px)` };
    default:
      return { backgroundImage: `radial-gradient(${line} 1px, transparent 1px)`, backgroundSize: "16px 16px" };
  }
}

/**
 * El "piso" de un ambiente: una grilla con textura donde se apoyan las fichas (VisualTile),
 * como muebles en un plano. El radio sigue la preferencia de redondeo.
 */
export function RoomFloor({ pattern = "dots", color, minTileWidth = 128, children }: RoomFloorProps) {
  const { token } = theme.useToken();
  const edge = color ? tint(token, color).border : token.colorBorderSecondary;
  // La textura va más suave que el borde: es un piso, no una grilla.
  const line = `color-mix(in srgb, ${edge} 55%, transparent)`;

  return (
    <div
      data-floor-pattern={pattern}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${minTileWidth}px, 100%), 1fr))`,
        gap: token.paddingSM,
        padding: token.paddingSM,
        borderRadius: token.borderRadiusLG * 1.5,
        border: `1px solid ${edge}`,
        backgroundColor: token.colorBgLayout,
        ...background(pattern, line),
      }}
    >
      {children}
    </div>
  );
}
