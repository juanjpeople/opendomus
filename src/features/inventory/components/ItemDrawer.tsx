"use client";

import { App, Button, Col, Divider, Drawer, Flex, Form, Grid, Input, InputNumber, Row, Select, Space, Switch, Typography, theme } from "antd";
import { ListPlus, PackageMinus, Save } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { StockTag } from "@/components/ui";
import { PricePanel } from "@/features/prices/components/PricePanel";
import { suggestedQuantity } from "@/features/shopping/domain";
import { useShoppingActions } from "@/features/shopping/hooks";
import { useContainers } from "@/features/storage/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n, useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { getStockStatus, INVENTORY_LIMITS, isUnit, UNITS, type InventoryItem, type InventoryItemPatch } from "../domain";
import { useConsumption, useInventoryActions, useInventoryItem } from "../hooks";
import { useConsumeWithUndo } from "./ConsumeButton";

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
            {t("inventory.consume.title")}
          </Typography.Title>
          <ConsumptionPanel item={item} />
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
      initialValues={{ name: item.name, minThreshold: item.minThreshold, unit: item.unit, containerId: item.containerId, autoSuggest: item.autoSuggest !== false }}
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
      <Form.Item name="autoSuggest" valuePropName="checked" label={t("inventory.item.autoSuggest")} tooltip={t("inventory.item.autoSuggestHint")}>
        <Switch />
      </Form.Item>
      {canEdit && (
        <Button type="primary" htmlType="submit" icon={<Save />} loading={saving}>
          {t("inventory.item.save")}
        </Button>
      )}
    </Form>
  );
}

/** Consumo: cuánto se usa (sale del historial), registrar un consumo y anotarlo en la lista. */
function ConsumptionPanel({ item }: { item: InventoryItem }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const stats = useConsumption(item.id);
  const consume = useConsumeWithUndo();
  const { add } = useShoppingActions();
  const { message } = App.useApp();
  const [amount, setAmount] = useState(1);
  const unit = (count: number) => (isUnit(item.unit) ? t(`inventory.units.${item.unit}`, { count }) : item.unit);

  return (
    <Flex vertical gap={16}>
      <div style={{ padding: 12, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("inventory.consume.last30")}
        </Typography.Text>
        <div style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {stats ? `${format.number(stats.last30)} ${unit(stats.last30)}` : "—"}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {stats?.lastAt
            ? t("inventory.consume.lastTime", { when: format.relative(stats.lastAt, now), count: stats.times })
            : t("inventory.consume.never")}
        </Typography.Text>
      </div>

      <Flex gap={8} wrap>
        <Can perform="inventory.consume">
          <Space.Compact>
            <InputNumber
              aria-label={t("inventory.consume.amount")}
              min={1}
              max={INVENTORY_LIMITS.maxQuantity}
              precision={0}
              value={amount}
              onChange={(value) => setAmount(value ?? 1)}
              style={{ width: 88 }}
            />
            <Button icon={<PackageMinus />} disabled={item.quantity <= 0} onClick={() => consume(item, amount)}>
              {t("inventory.consume.register")}
            </Button>
          </Space.Compact>
        </Can>
        <Can perform="shopping.manage">
          <Button
            icon={<ListPlus />}
            onClick={async () => {
              const quantity = suggestedQuantity(item);
              if (await add({ name: item.name, quantity, unit: item.unit, inventoryItemId: item.id })) {
                message.success(t("shopping.toast.added", { name: item.name }));
              }
            }}
          >
            {t("shopping.addToList")}
          </Button>
        </Can>
      </Flex>
    </Flex>
  );
}
