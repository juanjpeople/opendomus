"use client";

import { Button, Card, Empty, Flex, Popconfirm, Skeleton, Typography, theme } from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { QuantityStepper, StockTag } from "@/components/ui";
import { usePermission } from "@/lib/auth/hooks";
import { getStockStatus, INVENTORY_TYPES, type InventoryType } from "../domain";
import { useInventoryActions, useInventoryItems } from "../hooks";

export function InventoryList({ type }: { type: InventoryType }) {
  const { token } = theme.useToken();
  const items = useInventoryItems(type);
  const { adjust, remove } = useInventoryActions(type);
  const canAdjust = usePermission("inventory.adjust");
  const config = INVENTORY_TYPES[type];

  return (
    <Card title="Inventario actual" styles={{ body: { padding: 0 } }}>
      {items === undefined && <Skeleton active style={{ padding: 24 }} />}

      {items?.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`Todavía no hay ${config.itemNounPlural}.`}
          style={{ padding: 32 }}
        />
      )}

      <AnimatePresence initial={false}>
        {items?.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
          >
            <Flex justify="space-between" align="center" gap={16} wrap style={{ padding: "12px 24px" }}>
              <Flex vertical gap={4} style={{ minWidth: 0 }}>
                <Typography.Text strong ellipsis>
                  {item.name}
                </Typography.Text>
                <Flex gap={8} align="center" wrap>
                  <StockTag status={getStockStatus(item)} />
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    Mínimo: {item.minThreshold} {item.unit}
                  </Typography.Text>
                </Flex>
              </Flex>

              <Flex align="center" gap={8}>
                <QuantityStepper
                  value={item.quantity}
                  unit={item.unit}
                  onStep={canAdjust ? (delta) => adjust(item.id, delta) : undefined}
                />
                <Can perform="inventory.delete">
                  <Popconfirm
                    title={`¿Eliminar "${item.name}"?`}
                    okText="Eliminar"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancelar"
                    onConfirm={() => remove(item.id)}
                  >
                    <Button type="text" danger aria-label={`Eliminar ${item.name}`} icon={<Trash2 />} />
                  </Popconfirm>
                </Can>
              </Flex>
            </Flex>
          </motion.div>
        ))}
      </AnimatePresence>
    </Card>
  );
}
