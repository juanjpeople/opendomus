"use client";

import { formatUnit } from "@/features/inventory/format";

import { Button, Card, Flex, Popconfirm, Typography, theme } from "antd";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Eye, PackageOpen, Tag as PriceTag, Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { EmptyState, IconTile, ListRow, QuantityStepper, StockTag, LoadingSkeleton } from "@/components/ui";
import { usePriceSummaries } from "@/features/prices/hooks";
import { usePreferences } from "@/hooks/usePreferences";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { getStockStatus, isInStock } from "../domain";
import { useInventoryActions, useInventoryItems } from "../hooks";
import { ConsumeButton } from "./ConsumeButton";
import { findCatalogProduct } from "../catalog";
import { CATEGORY_APPEARANCE } from "../catalog-appearance";

interface InventoryListProps {
  containerId: string;
  /** Abre el detalle del producto (datos, lugar y precios). */
  onOpen: (itemId: string) => void;
  /** Producto al que se llegó (`?item=`): se resalta y se lleva a la vista. */
  highlightId?: string | null;
}

/**
 * Productos de un contenedor. Lo que está en 0 no se lista (salvo que el perfil pida verlo en "Vista"):
 * queda una línea con cuántos se ocultaron y un botón para verlos. Lo que se agota mientras mirás
 * sigue en su lugar, así no desaparece debajo del dedo y se puede deshacer o sumar.
 */
export function InventoryList({ containerId, onOpen, highlightId }: InventoryListProps) {
  const { token } = theme.useToken();
  const { t, format } = useI18n();
  const items = useInventoryItems(containerId);
  const prices = usePriceSummaries(containerId);
  const { adjust, remove } = useInventoryActions();
  const canAdjust = usePermission("inventory.adjust");
  const unitLabel = (unit: string, count: number) => (formatUnit(t, count, unit));
  const { showEmptyItems } = usePreferences();
  const [revealed, setRevealed] = useState(false);
  // Lo que se vio con stock en esta visita. Se actualiza durante el render (patrón de React para
  // derivar estado), así el producto que llega a 0 nunca llega a pintarse oculto.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const fresh = items?.filter((item) => isInStock(item) && !seen.has(item.id)) ?? [];
  if (fresh.length) setSeen(new Set([...seen, ...fresh.map((item) => item.id)]));
  const showAll = showEmptyItems || revealed;
  const visible = items?.filter((item) => showAll || isInStock(item) || seen.has(item.id) || item.id === highlightId);
  const hidden = (items?.length ?? 0) - (visible?.length ?? 0);
  const loaded = items !== undefined;
  useEffect(() => {
    if (loaded && highlightId) document.getElementById(`item-${highlightId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [loaded, highlightId]);

  return (
    <Card styles={{ body: { padding: 0 } }}>
      {items === undefined && <LoadingSkeleton style={{ padding: token.paddingLG }} />}

      {items?.length === 0 && (
        <EmptyState icon={PackageOpen} title={t("inventory.list.emptyShort")} description={t("inventory.list.emptyHint")} />
      )}

      <AnimatePresence>
        {visible?.map((item, index) => {
          const price = prices?.get(item.id);
          const category = findCatalogProduct(item.name)?.category;
          const appearance = category ? CATEGORY_APPEARANCE[category] : undefined;
          return (
            <ListRow key={item.id} id={`item-${item.id}`} highlighted={item.id === highlightId} index={index} divider={index < visible.length - 1 || hidden > 0}
              title={item.name} leading={<IconTile icon={appearance?.Icon ?? PackageOpen} color={appearance?.color} size={token.controlHeight} />}
              onOpen={() => onOpen(item.id)} openLabel={t("inventory.list.openAria", { name: item.name })}
              meta={<>
                      <StockTag status={getStockStatus(item)} tool={item.reusable} />
                      {!item.reusable && (
                        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                          {t("inventory.list.min", { min: item.minThreshold, unit: unitLabel(item.unit, item.minThreshold) })}
                        </Typography.Text>
                      )}
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

      {hidden > 0 && (
        <Flex align="center" justify="space-between" gap={token.marginSM} wrap style={{ padding: `${token.paddingXS}px ${token.padding}px` }}>
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t("storage.hiddenEmpty", { count: hidden })}</Typography.Text>
          <Button type="text" icon={<Eye />} onClick={() => setRevealed(true)} style={{ minHeight: token.controlHeightLG + token.paddingXXS }}>
            {t("storage.showHidden")}
          </Button>
        </Flex>
      )}
    </Card>
  );
}
