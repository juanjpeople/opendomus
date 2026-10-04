"use client";

import { Button, Flex, Tooltip, Typography, theme } from "antd";
import { motion } from "framer-motion";
import { Layers, Plus, QrCode } from "lucide-react";
import Link from "next/link";
import { IconTile } from "@/components/ui";
import { useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { SPRING } from "@/lib/motion";
import { containerAppearance } from "../domain";
import type { ContainerOverview } from "../hooks";

/** Tarjeta de un contenedor (o compartimento): ícono y color propios, totales y barra de stock. */
export function ContainerTile({ container, onLabel }: { container: ContainerOverview; onLabel: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const { color, Icon } = containerAppearance(container);
  const palette = tint(token, color);

  return (
    <motion.div
      whileHover="hover"
      initial="rest"
      animate="rest"
      variants={{ rest: { y: 0 }, hover: { y: -3 } }}
      transition={SPRING.snappy}
      style={{ position: "relative" }}
    >
      <Link href={`/inventario/${container.id}`} style={{ display: "block", color: "inherit" }}>
        <motion.div
          variants={{ rest: { borderColor: token.colorBorderSecondary }, hover: { borderColor: palette.solid } }}
          style={{
            height: "100%",
            padding: 12,
            borderRadius: token.borderRadiusLG,
            // Propiedades separadas (no el atajo `border`): el color se anima en hover.
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: token.colorBorderSecondary,
            background: token.colorBgContainer,
            boxShadow: token.boxShadowTertiary,
          }}
        >
          <motion.div variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: -8, scale: 1.06 } }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
            <IconTile icon={Icon} color={color} size={38} />
          </motion.div>
          <Typography.Text strong ellipsis style={{ display: "block", marginTop: 10 }}>
            {container.name}
          </Typography.Text>
          <Flex justify="space-between" align="baseline" gap={6}>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("storage.itemCount", { count: container.itemCount })}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontFamily: "var(--font-geist-mono)", fontSize: token.fontSizeSM - 1, letterSpacing: "0.08em" }}>
              {container.code}
            </Typography.Text>
          </Flex>
          {container.children.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Layers /> {t("storage.childCount", { count: container.children.length })}
            </Typography.Text>
          )}
          <StockBar ok={container.itemCount - container.needsAttention} low={container.low} empty={container.empty} />
        </motion.div>
      </Link>
      <Tooltip title={t("storage.label")}>
        <Button
          type="text"
          size="small"
          icon={<QrCode />}
          aria-label={t("storage.label")}
          onClick={onLabel}
          style={{ position: "absolute", top: 8, right: 8, color: token.colorTextTertiary }}
        />
      </Tooltip>
    </motion.div>
  );
}

/** Barra de estado del contenido: verde en stock, ámbar bajo, rojo agotado (gris si está vacío). */
export function StockBar({ ok, low, empty }: { ok: number; low: number; empty: number }) {
  const { token } = theme.useToken();
  const t = useT();
  const total = ok + low + empty;
  const segments = [
    { value: ok, color: token.colorSuccess, label: t("inventory.stock.ok") },
    { value: low, color: token.colorWarning, label: t("inventory.stock.low") },
    { value: empty, color: token.colorError, label: t("inventory.stock.empty") },
  ].filter((segment) => segment.value > 0);

  return (
    <Tooltip title={segments.map((segment) => `${segment.label}: ${segment.value}`).join(" · ") || undefined}>
      <div style={{ display: "flex", gap: 2, height: 6, marginTop: 10, borderRadius: 3, overflow: "hidden", background: token.colorFillSecondary }}>
        {total > 0 &&
          segments.map((segment) => (
            <motion.span
              key={segment.label}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: segment.value }}
              transition={SPRING.soft}
              style={{ flexBasis: 0, background: segment.color }}
            />
          ))}
      </div>
    </Tooltip>
  );
}

export function AddTile({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  const { token } = theme.useToken();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3, borderColor: color, color }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING.snappy}
      style={{
        minHeight: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: "pointer",
        font: "inherit",
        fontSize: token.fontSizeSM,
        color: token.colorTextTertiary,
        background: "transparent",
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: token.colorBorder,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <span style={{ fontSize: 20, display: "inline-flex" }}>
        <Plus />
      </span>
      {label}
    </motion.button>
  );
}
