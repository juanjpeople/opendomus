"use client";

import { Tag } from "antd";
import { motion } from "framer-motion";
import { STOCK_STATUS_META, type StockStatus } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { SPRING } from "@/lib/motion";

/** Estado de stock con color semántico. Calcular el estado con `getStockStatus(item)`. Hace "pop" al cambiar. */
export function StockTag({ status }: { status: StockStatus }) {
  const t = useT();
  const { color } = STOCK_STATUS_META[status];
  return (
    <motion.span key={status} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.snappy} style={{ display: "inline-flex" }}>
      <Tag color={color} variant="filled" style={{ marginInlineEnd: 0 }}>
        {t(`inventory.stock.${status}`)}
      </Tag>
    </motion.span>
  );
}
