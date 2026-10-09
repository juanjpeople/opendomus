"use client";

import { theme } from "antd";
import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useT } from "@/i18n";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

export interface PathCrumb {
  label: string;
  /** Sin `href`, es la página actual (lleva `aria-current`). */
  href?: string;
  icon?: LucideIcon;
}

/**
 * Dónde estás, tocable: Inventario › Taller › Estantería. Cada tramo lleva a su página y mide
 * 44 px de alto también en celular, donde las migas de la cabecera no aparecen. Si la ruta no
 * entra en una línea, se parte en varias: nunca se recorta un nombre.
 */
export function PathCrumbs({ items, label }: { items: PathCrumb[]; label?: string }) {
  const t = useT();
  const { token } = theme.useToken();
  const tramo: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: token.marginXXS + 2,
    minHeight: token.controlHeightLG + token.paddingXXS,
    paddingInline: token.paddingXS,
    borderRadius: token.borderRadius,
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
  };

  return (
    <nav aria-label={label ?? t("nav.path")}>
      <ol style={{ display: "flex", flexWrap: "wrap", alignItems: "center", margin: `0 0 0 -${token.paddingXS}px`, padding: 0, listStyle: "none" }}>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          const Icon = item.icon;
          const content = (
            <>
              {Icon && <Icon />}
              <span style={{ overflowWrap: "anywhere" }}>{item.label}</span>
            </>
          );
          return (
            <li key={`${index}:${item.label}`} style={{ display: "inline-flex", alignItems: "center", minWidth: 0 }}>
              {item.href && !last ? (
                <motion.span
                  whileHover={{ y: HOVER_LIFT.chip, backgroundColor: token.colorFillTertiary }}
                  whileTap={{ scale: TAP.control }}
                  transition={SPRING.snappy}
                  style={{ display: "inline-flex", borderRadius: token.borderRadius, backgroundColor: "rgba(0, 0, 0, 0)" }}
                >
                  <Link href={item.href} className="od-focusable" style={{ ...tramo, "--od-ring": token.colorPrimary, color: token.colorTextSecondary } as CSSProperties}>
                    {content}
                  </Link>
                </motion.span>
              ) : (
                <span aria-current={last ? "page" : undefined} style={{ ...tramo, color: token.colorText, fontWeight: token.fontWeightStrong }}>
                  {content}
                </span>
              )}
              {!last && (
                <span aria-hidden style={{ display: "inline-flex", color: token.colorTextQuaternary }}>
                  <ChevronRight />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
