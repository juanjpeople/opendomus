"use client";

import { Tooltip, theme } from "antd";
import { motion } from "framer-motion";
import { Plus, QrCode } from "lucide-react";
import { useT } from "@/i18n";
import { DURATION, HOVER_LIFT, SPRING, TAP } from "@/lib/motion";
import { containerAppearance } from "../domain";
import type { ContainerOverview } from "../hooks";
import { containerHref } from "@/lib/navigation/routes";
import { ContainerScene } from "./ContainerScene";
import { VisualTile } from "@/components/ui";
import { normalizeSearch } from "@/lib/search";

/** Resumen de una línea: el tipo (si el nombre no lo dice) y qué tiene adentro. */
export function useContainerSummary() {
  const t = useT();
  return (container: ContainerOverview) => {
    const kind = t(`storage.containerKinds.${container.kind}`);
    const contents = container.itemCount > 0
      ? t("storage.itemCount", { count: container.itemCount })
      : container.contentCount > 0 ? t("storage.noteCount", { count: container.contentCount }) : null;
    return [normalizeSearch(container.name).includes(normalizeSearch(kind)) ? null : kind, contents,
      container.children.length > 0 ? t("storage.childCount", { count: container.children.length }) : null].filter(Boolean).join(" · ");
  };
}

/**
 * Tarjeta de un contenedor (o compartimento): ícono y color propios, totales y barra de stock.
 * `meta` reemplaza el resumen (la vista de tarjetas muestra dónde está).
 */
export function ContainerTile({ container, onLabel, meta }: { container: ContainerOverview; onLabel?: () => void; meta?: string }) {
  const t = useT();
  const summary = useContainerSummary();
  const { color } = containerAppearance(container);
  return <VisualTile href={containerHref(container.id)} color={color}
    media={<ContainerScene container={container} />} title={container.name} meta={meta ?? (summary(container) || undefined)}
    footer={container.itemCount > 0 ? <StockBar ok={container.itemCount - container.needsAttention} low={container.low} empty={container.empty} /> : undefined}
    action={onLabel ? { icon: <QrCode />, label: `${t("storage.label")}: ${container.name}`, onClick: onLabel } : undefined} />;
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
      <div role="img" aria-label={segments.map((segment) => `${segment.label}: ${segment.value}`).join(" · ") || t("inventory.stock.empty")} style={{ display: "flex", gap: token.lineWidth * 2, height: token.paddingXXS + token.lineWidth * 2, marginTop: token.marginSM, borderRadius: token.borderRadiusSM, overflow: "hidden", background: token.colorFillSecondary }}>
        {total > 0 &&
          segments.map((segment) => (
            <motion.span
              key={segment.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.fast }}
              style={{ flexBasis: 0, flexGrow: segment.value, background: segment.color }}
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
      className="od-focusable"
      onClick={onClick}
      whileHover={{ y: HOVER_LIFT.card, borderColor: color, color }}
      whileTap={{ scale: TAP.control }}
      transition={SPRING.snappy}
      style={{
        minHeight: token.controlHeightLG * 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: token.marginXS,
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
      <span style={{ fontSize: token.fontSizeXL, display: "inline-flex" }}>
        <Plus />
      </span>
      {label}
    </motion.button>
  );
}
