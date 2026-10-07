"use client";

import { formatUnit } from "@/features/inventory/format";

import { Button, Card, Flex, Popconfirm, Skeleton, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { PackageOpen, Tag as PriceTag, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { EmptyState, IconTile, ListRow, QuantityStepper, StockTag } from "@/components/ui";
import { usePriceSummaries } from "@/features/prices/hooks";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { getStockStatus } from "../domain";
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
  const unitLabel = (unit: string, count: number) => (formatUnit(t, count, unit));

  return (
    <Card styles={{ body: { padding: 0 } }}>
      {items === undefined && <Skeleton active style={{ padding: 24 }} />}

      {items?.length === 0 && <EmptyState icon={PackageOpen} title={t("inventory.list.emptyTitle")} description={t("inventory.list.emptyText")} />}

      <AnimatePresence>
        {items?.map((item, index) => {
          const price = prices?.get(item.id);
          const category = findCatalogProduct(item.name)?.category;
          const appearance = category ? CATEGORY_APPEARANCE[category] : undefined;
          return (
            <ListRow key={item.id} index={index} divider={index < items.length - 1}
              title={item.name} leading={<IconTile icon={appearance?.Icon ?? PackageOpen} color={appearance?.color} size={token.controlHeight} />}
              onOpen={() => onOpen(item.id)} openLabel={t("inventory.list.openAria", { name: item.name })}
              meta={<>
                      <StockTag status={getStockStatus(item)} />
                      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {t("inventory.list.min", { min: item.minThreshold, unit: unitLabel(item.unit, item.minThreshold) })}
                      </Typography.Text>
                      {price && (
                        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <PriceTag /> {format.money(price.latest.amountCents, price.latest.currency)}
                        </Typography.Text>
                      )}
              </>}
              trailing={<Flex align="center" gap={token.marginXS} wrap>
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
              </Flex>} />
          );
        })}
      </AnimatePresence>
    </Card>
  );
}
