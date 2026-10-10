"use client";

import { Tag } from "antd";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import { STOCK_STATUS_META, type StockStatus } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";

/**
 * Estado de stock con color semántico. Calcular el estado con `getStockStatus(item)`. Hace "pop" al cambiar.
 * `tool`: herramienta o equipo (`item.reusable`). Si la tenés dice "Herramienta" en vez de "En stock":
 * no se gasta, así que "bajo" no aplica.
 */
export function StockTag({ status, tool = false }: { status: StockStatus; tool?: boolean }) {
  const t = useT();
  const { color } = STOCK_STATUS_META[status];
  if (tool && status !== "empty") {
    return (
      <motion.span key="tool" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
        <Tag color="blue" variant="filled" icon={<Wrench />} style={{ marginInlineEnd: 0 }}>
          {t("inventory.stock.tool")}
        </Tag>
      </motion.span>
    );
  }
  return (
    <motion.span key={status} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
      <Tag color={color} variant="filled" style={{ marginInlineEnd: 0 }}>
        {t(`inventory.stock.${status}`)}
      </Tag>
    </motion.span>
  );
}
