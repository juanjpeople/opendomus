"use client";

import { Button, Card, Flex, Popconfirm, Skeleton, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, PackageOpen, Tag as PriceTag, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { EmptyState, IconTile, QuantityStepper, StockTag } from "@/components/ui";
import { usePriceSummaries } from "@/features/prices/hooks";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { getStockStatus, isUnit } from "../domain";
import { useInventoryActions, useInventoryItems } from "../hooks";
import { ConsumeButton } from "./ConsumeButton";
import { findCatalogProduct } from "../catalog";
import { CATEGORY_APPEARANCE } from "../catalog-appearance";

interface InventoryListProps {
  containerId: string;
  /** Abre el detalle del producto (datos, lugar y precios). */
  onOpen: (itemId: string) => void;
}

export function InventoryList({ containerId, onOpen }: InventoryListProps) {
  const { token } = theme.useToken();
  const { t, format } = useI18n();
  const items = useInventoryItems(containerId);
  const prices = usePriceSummaries(containerId);
  const { adjust, remove } = useInventoryActions();
  const canAdjust = usePermission("inventory.adjust");
  const unitLabel = (unit: string, count: number) => (isUnit(unit) ? t(`inventory.units.${unit}`, { count }) : unit);

  return (
    <Card title={t("inventory.list.title")} styles={{ body: { padding: 0 } }}>
      {items === undefined && <Skeleton active style={{ padding: 24 }} />}

      {items?.length === 0 && <EmptyState icon={PackageOpen} title={t("inventory.list.emptyTitle")} description={t("inventory.list.emptyText")} />}

      <AnimatePresence>
        {items?.map((item, index) => {
          const price = prices?.get(item.id);
          const category = findCatalogProduct(item.name)?.category;
          const appearance = category ? CATEGORY_APPEARANCE[category] : undefined;
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              // Entrada escalonada (tope de 8 filas para que una lista larga no haga esperar).
              animate={{ opacity: 1, x: 0, transition: { ...SPRING.snappy, delay: Math.min(index, 8) * 0.03 } }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.18 } }}
              whileHover={{ backgroundColor: token.colorFillQuaternary, transition: { duration: 0.15 } }}
              transition={SPRING.snappy}
              style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, backgroundColor: "rgba(0,0,0,0)" }}
            >
              <Flex justify="space-between" align="center" gap={16} wrap style={{ padding: "12px 24px" }}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  aria-label={t("inventory.list.openAria", { name: item.name })}
                  style={{ all: "unset", cursor: "pointer", minWidth: 0, flex: "1 1 220px" }}
                >
                  <Flex vertical gap={4}>
                    <Flex align="center" gap={4}>
                      {appearance && <IconTile icon={appearance.Icon} color={appearance.color} size={28} />}
                      <Typography.Text strong ellipsis>
                        {item.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ display: "inline-flex" }}>
                        <ChevronRight />
                      </Typography.Text>
                    </Flex>
                    <Flex gap={8} align="center" wrap>
                      <StockTag status={getStockStatus(item)} />
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {t("inventory.list.min", { min: item.minThreshold, unit: unitLabel(item.unit, item.minThreshold) })}
                      </Typography.Text>
                      {price && (
                        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <PriceTag /> {format.money(price.latest.amountCents, price.latest.currency)}
                        </Typography.Text>
                      )}
                    </Flex>
                  </Flex>
                </button>

                <Flex align="center" gap={8}>
                  {!item.reusable && <Can perform="inventory.consume">
                    <ConsumeButton item={item} />
                  </Can>}
                  <QuantityStepper
                    value={item.quantity}
                    unit={unitLabel(item.unit, item.quantity)}
                    onStep={canAdjust ? (delta) => adjust(item.id, delta) : undefined}
                  />
                  <Can perform="inventory.delete">
                    <Popconfirm
                      title={t("inventory.list.deleteConfirm", { name: item.name })}
                      okText={t("inventory.list.deleteOk")}
                      okButtonProps={{ danger: true }}
                      cancelText={t("common.cancel")}
                      onConfirm={() => remove(item.id)}
                    >
                      <Button type="text" danger aria-label={t("inventory.list.deleteAria", { name: item.name })} icon={<Trash2 />} />
                    </Popconfirm>
                  </Can>
                </Flex>
              </Flex>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </Card>
  );
}
