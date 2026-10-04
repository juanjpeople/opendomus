"use client";

import { Button, Col, Divider, Drawer, Flex, Form, Grid, Input, InputNumber, Row, Select, Typography } from "antd";
import { Save } from "lucide-react";
import { useState } from "react";
import { StockTag } from "@/components/ui";
import { PricePanel } from "@/features/prices/components/PricePanel";
import { useContainers } from "@/features/storage/hooks";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { getStockStatus, INVENTORY_LIMITS, UNITS, type InventoryItem, type InventoryItemPatch } from "../domain";
import { useInventoryActions, useInventoryItem } from "../hooks";

/** Detalle de un producto: datos, lugar (moverlo de contenedor) y precios. */
export function ItemDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const t = useT();
  const item = useInventoryItem(itemId);
  const screens = Grid.useBreakpoint();

  return (
    <Drawer
      open={!!itemId}
      onClose={onClose}
      size={screens.sm ? 480 : "100%"}
      destroyOnHidden
      title={
        item ? (
          <Flex align="center" gap={8}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
            <StockTag status={getStockStatus(item)} />
          </Flex>
        ) : null
      }
    >
      {item && (
        <>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t("inventory.item.details")}
          </Typography.Title>
          <ItemForm item={item} />
          <Divider />
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t("prices.title")}
          </Typography.Title>
          <PricePanel itemId={item.id} itemName={item.name} />
        </>
      )}
    </Drawer>
  );
}

function ItemForm({ item }: { item: InventoryItem }) {
  const t = useT();
  const containers = useContainers();
  const { update } = useInventoryActions();
  const canEdit = usePermission("inventory.create");
  const [saving, setSaving] = useState(false);

  // Contenedores agrupados por recinto para el selector "Lugar".
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const container of containers ?? []) {
    const group = groups.get(container.spaceName) ?? [];
    group.push({ value: container.id, label: container.path });
    groups.set(container.spaceName, group);
  }

  async function onFinish(values: InventoryItemPatch) {
    setSaving(true);
    await update(item.id, values);
    setSaving(false);
  }

  return (
    <Form
      layout="vertical"
      initialValues={{ name: item.name, minThreshold: item.minThreshold, unit: item.unit, containerId: item.containerId }}
      onFinish={onFinish}
      disabled={!canEdit}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={t("inventory.form.name")}
        rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }, { max: INVENTORY_LIMITS.nameMaxLength }]}
      >
        <Input maxLength={INVENTORY_LIMITS.nameMaxLength} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item name="minThreshold" label={t("inventory.form.min")} tooltip={t("inventory.form.minTooltip")}>
            <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="unit" label={t("inventory.form.unit")}>
            <Select options={UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }))} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="containerId" label={t("inventory.item.location")}>
        <Select
          showSearch={{ optionFilterProp: "label" }}
          options={[...groups].map(([spaceName, options]) => ({ label: spaceName, options }))}
        />
      </Form.Item>
      {canEdit && (
        <Button type="primary" htmlType="submit" icon={<Save />} loading={saving}>
          {t("inventory.item.save")}
        </Button>
      )}
    </Form>
  );
}
