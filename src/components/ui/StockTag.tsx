"use client";

import { Tag } from "antd";
import { STOCK_STATUS_META, type StockStatus } from "@/features/inventory/domain";

/** Estado de stock con color semántico. Calcular el estado con `getStockStatus(item)`. */
export function StockTag({ status }: { status: StockStatus }) {
  const { label, color } = STOCK_STATUS_META[status];
  return (
    <Tag color={color} variant="filled" style={{ marginInlineEnd: 0 }}>
      {label}
    </Tag>
  );
}
