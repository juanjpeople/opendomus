"use client";

import { surfaceBackground } from "@/skins/surface";
import { useSkin } from "@/skins/useSkin";
import { formatQuantity, formatUnit } from "@/features/inventory/format";

import { App, Button, Col, Collapse, Divider, Drawer, Flex, Form, Grid, Input, InputNumber, Row, Select, Space, Switch, Typography, theme } from "antd";
import { Boxes, ListPlus, PackageMinus, PackageOpen, Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Can } from "@/components/auth/Can";
import { IconTile, PathCrumbs, QuantityStepper, StockTag } from "@/components/ui";
import { PricePanel } from "@/features/prices/components/PricePanel";
import { suggestedQuantity } from "@/features/shopping/domain";
import { useShoppingActions } from "@/features/shopping/hooks";
import { useContainer, useContainers } from "@/features/storage/hooks";
import { useNow } from "@/hooks/useNow";
import { useI18n, useT } from "@/i18n";
import { tint } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { containerHref, spaceHref } from "@/lib/navigation/routes";
import { findCatalogProduct } from "../catalog";
import { CATEGORY_APPEARANCE } from "../catalog-appearance";
import { getStockStatus, INVENTORY_LIMITS, UNITS, type InventoryItem, type InventoryItemPatch } from "../domain";
import { useConsumption, useInventoryActions, useInventoryItem } from "../hooks";
import { useConsumeWithUndo } from "./ConsumeButton";

/**
 * Ficha de un producto: primero cuánto hay y las acciones de todos los días; después dónde está,
 * cuánto se usa, sus datos (plegados) y los precios.
 */
export function ItemDrawer({ itemId, onClose }: { itemId: string | null; onClose: () => void }) {
  const t = useT();
  const { token } = theme.useToken();
  const item = useInventoryItem(itemId);
  const screens = Grid.useBreakpoint();
  const appearance = item ? itemAppearance(item) : undefined;

  return (
    <Drawer
      open={!!itemId}
      onClose={onClose}
      size={screens.sm ? 480 : "100%"}
      destroyOnHidden
      title={
        item ? (
          <Flex align="center" gap={token.marginXS}>
            <IconTile icon={appearance?.Icon ?? PackageOpen} color={appearance?.color} size={token.controlHeight} solid />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
            <StockTag status={getStockStatus(item)} tool={item.reusable} />
          </Flex>
        ) : null
      }
    >
      {item && (
        <>
          <QuantityPanel item={item} />
          <Divider />
          <LocationPanel item={item} />
          <Divider />
          <PanelTitle>{t("inventory.consume.title")}</PanelTitle>
          <ConsumptionPanel item={item} />
          <Divider />
          <Collapse
            ghost
            items={[{ key: "details", label: <Typography.Text strong>{t("inventory.item.details")}</Typography.Text>, forceRender: true, children: <ItemForm item={item} /> }]}
            style={{ marginInline: -token.padding }}
          />
          <Divider />
          <PanelTitle>{t("prices.title")}</PanelTitle>
          <PricePanel itemId={item.id} itemName={item.name} />
        </>
      )}
    </Drawer>
  );
}

/** Ícono y color del rubro del producto, si está en el catálogo. */
function itemAppearance(item: InventoryItem) {
  const category = findCatalogProduct(item.name)?.category;
  return category ? CATEGORY_APPEARANCE[category] : undefined;
}

function PanelTitle({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  return <Typography.Title level={5} style={{ margin: `0 0 ${token.marginSM}px` }}>{children}</Typography.Title>;
}

/** Cuánto hay, con +/- grande, "Usé uno" y anotarlo en la lista de compras. */
function QuantityPanel({ item }: { item: InventoryItem }) {
  const t = useT();
  const { token } = theme.useToken();
  const { adjust } = useInventoryActions();
  const consume = useConsumeWithUndo();
  const { add } = useShoppingActions();
  const { message } = App.useApp();
  const canAdjust = usePermission("inventory.adjust");
  const skin = useSkin();
  const palette = tint(token, itemAppearance(item)?.color ?? "blue");

  return (
    <Flex
      vertical
      gap={token.margin}
      style={{
        padding: token.padding,
        borderRadius: token.borderRadiusLG * 2,
        border: `${token.lineWidth}px solid ${palette.border}`,
        background: surfaceBackground(skin, palette.bg, token.colorBgContainer, 70),
      }}
    >
      <Flex align="center" justify="space-between" gap={token.marginSM} wrap>
        <Typography.Text type="secondary">{t("inventory.item.quantity")}</Typography.Text>
        <div style={{ fontSize: token.fontSizeHeading4 }}>
          <QuantityStepper
            aria-label={t("inventory.item.quantity")}
            value={item.quantity}
            unit={formatUnit(t, item.quantity, item.unit)}
            onStep={canAdjust ? (delta) => adjust(item.id, delta) : undefined}
          />
        </div>
      </Flex>
      <Flex gap={token.marginXS} wrap>
        {!item.reusable && (
          <Can perform="inventory.consume">
            <Button icon={<PackageMinus />} disabled={item.quantity <= 0} onClick={() => consume(item)}>
              {t("inventory.consume.one")}
            </Button>
          </Can>
        )}
        <Can perform="shopping.manage">
          <Button
            icon={<ListPlus />}
            onClick={async () => {
              if (await add({ name: item.name, quantity: suggestedQuantity(item), unit: item.unit, inventoryItemId: item.id })) {
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

/** Dónde está (cada tramo abre su página) y moverlo a otro lugar sin abrir el formulario. */
function LocationPanel({ item }: { item: InventoryItem }) {
  const t = useT();
  const { token } = theme.useToken();
  const container = useContainer(item.containerId);
  const containers = useContainers();
  const { update } = useInventoryActions();
  const canEdit = usePermission("inventory.create");

  // Contenedores agrupados por recinto para "Mover a".
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const candidate of containers ?? []) {
    const group = groups.get(candidate.spaceName) ?? [];
    group.push({ value: candidate.id, label: candidate.path });
    groups.set(candidate.spaceName, group);
  }

  return (
    <Flex vertical gap={token.marginXS}>
      <PanelTitle>{t("inventory.item.where")}</PanelTitle>
      {container && (
        <PathCrumbs
          label={t("inventory.item.where")}
          items={[
            { label: container.spaceName, href: spaceHref(container.spaceId), icon: Boxes },
            ...container.ancestors.map((ancestor) => ({ label: ancestor.name, href: containerHref(ancestor.id) })),
            { label: container.name, href: containerHref(container.id) },
          ]}
        />
      )}
      {canEdit && (
        <Select
          aria-label={t("inventory.item.moveTo")}
          placeholder={t("inventory.item.moveTo")}
          value={null}
          showSearch={{ optionFilterProp: "label" }}
          options={[...groups].map(([spaceName, options]) => ({ label: spaceName, options: options.filter((option) => option.value !== item.containerId) }))}
          onChange={(containerId: string | null) => { if (containerId) void update(item.id, { containerId }); }}
          style={{ width: "100%" }}
        />
      )}
    </Flex>
  );
}

function ItemForm({ item }: { item: InventoryItem }) {
  const t = useT();
  const { update } = useInventoryActions();
  const canEdit = usePermission("inventory.create");
  const [saving, setSaving] = useState(false);

  async function onFinish(values: InventoryItemPatch) {
    setSaving(true);
    await update(item.id, values);
    setSaving(false);
  }

  return (
    <Form
      layout="vertical"
      name={`item-${item.id}`}
      initialValues={{ name: item.name, minThreshold: item.minThreshold, unit: item.unit, autoSuggest: item.autoSuggest !== false, reusable: item.reusable === true }}
      onFinish={onFinish}
      disabled={!canEdit}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={t("inventory.form.name")}
        rules={[{ required: true, whitespace: true, message: t("errors.validation.nameRequired") }, { max: INVENTORY_LIMITS.nameMaxLength }]}
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
      <Form.Item name="autoSuggest" valuePropName="checked" label={t("inventory.item.autoSuggest")} tooltip={t("inventory.item.autoSuggestHint")}>
        <Switch />
      </Form.Item>
      <Form.Item name="reusable" valuePropName="checked" label={t("inventory.item.reusable")} tooltip={t("inventory.item.reusableHint")}>
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

/** Consumo: cuánto se usa (sale del historial) y registrar más de uno a la vez. */
function ConsumptionPanel({ item }: { item: InventoryItem }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const now = useNow();
  const stats = useConsumption(item.id);
  const consume = useConsumeWithUndo();
  const [amount, setAmount] = useState(1);

  return (
    <Flex vertical gap={16}>
      <div style={{ padding: 12, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {t("inventory.consume.last30")}
        </Typography.Text>
        <div style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {stats ? formatQuantity(t, stats.last30, item.unit, format.number) : "—"}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {stats?.lastAt
            ? t("inventory.consume.lastTime", { when: format.relative(stats.lastAt, now), count: stats.times })
            : t("inventory.consume.never")}
        </Typography.Text>
      </div>

      {!item.reusable && (
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
      )}
    </Flex>
  );
}
