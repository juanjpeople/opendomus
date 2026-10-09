"use client";

import { Typography, theme } from "antd";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { tint, type AppearanceColor } from "@/lib/appearance";
import { HOVER_LIFT, SPRING, TAP } from "@/lib/motion";

/**
 * Acceso compacto: un ícono del lugar o un punto de estado, el nombre y dónde está.
 * 44 px de alto; el tooltip nativo (`title`) completa el contexto.
 */
export function PlaceChip({ href, label, detail, icon: Icon, color, dot, ariaLabel, title }: {
  href: string; label: string; detail?: string; icon?: LucideIcon; color?: AppearanceColor; dot?: string; ariaLabel?: string; title?: string;
}) {
  const { token } = theme.useToken();
  const palette = color ? tint(token, color) : { solid: token.colorPrimary, bg: token.colorBgContainer, border: token.colorBorderSecondary };
  return (
    <motion.span whileHover={{ y: HOVER_LIFT.chip }} whileTap={{ scale: TAP.control }} transition={SPRING.snappy} style={{ display: "inline-flex", maxWidth: "100%" }}>
      <Link
        href={href}
        aria-label={ariaLabel}
        title={title}
        className="od-focusable"
        style={{
          "--od-ring": palette.solid,
          display: "inline-flex",
          alignItems: "center",
          gap: token.marginXS,
          maxWidth: "100%",
          minHeight: token.controlHeightLG + token.paddingXXS,
          padding: `${token.paddingXXS}px ${token.paddingSM}px`,
          borderRadius: token.borderRadiusLG,
          border: `${token.lineWidth}px solid ${palette.border}`,
          background: palette.bg,
          color: token.colorText,
        } as CSSProperties}
      >
        {Icon ? (
          <span style={{ display: "inline-flex", color: palette.solid }}>
            <Icon />
          </span>
        ) : (
          <span aria-hidden style={{ width: token.marginXS, height: token.marginXS, borderRadius: "50%", flexShrink: 0, background: dot }} />
        )}
        <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          {label}
          {detail && <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}> · {detail}</Typography.Text>}
        </span>
      </Link>
    </motion.span>
  );
}
