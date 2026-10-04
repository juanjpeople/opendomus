"use client";

import { AutoComplete, Button, Flex, Grid, InputNumber, Popover, Select, Space, Tooltip, Typography, theme } from "antd";
import { Calculator, Tag as PriceTag } from "lucide-react";
import { useState } from "react";
import { isUnit } from "@/features/inventory/domain";
import { CURRENCIES, type Currency } from "@/features/prices/domain";
import { useKnownStores } from "@/features/prices/hooks";
import { useI18n } from "@/i18n";
import { useShoppingActions, type ShoppingRow } from "../hooks";

/**
 * "¿Cuánto salió?" justo después de comprar: cuenta para el presupuesto de la lista y, si el
 * producto está vinculado, queda en su historial de precios (y más adelante, en las cuentas).
 */
export function QuickPrice({ row, currency: listCurrency }: { row: ShoppingRow; currency: Currency }) {
  const { t, format } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const stores = useKnownStores();
  const { paid } = useShoppingActions();
  const [open, setOpen] = useState(false);
  const initialUnit = row.paidCents !== undefined ? row.paidCents / row.quantity / 100 : row.estimateCents !== undefined ? row.estimateCents / 100 : row.price ? row.price.latest.amountCents / 100 : null;
  const [amount, setAmount] = useState<number | null>(initialUnit);
  const [currency, setCurrency] = useState<Currency>(row.paidCurrency ?? listCurrency);
  const [store, setStore] = useState(row.store ?? row.price?.latest.store ?? "");
  const [saving, setSaving] = useState(false);
  const unitLabel = isUnit(row.unit) ? t(`inventory.units.${row.unit}`, { count: 1 }) : row.unit;
  const label = row.paidCents !== undefined ? format.money(row.paidCents, row.paidCurrency ?? listCurrency) : t("shopping.price.button");

  async function save() {
    if (!amount) return;
    setSaving(true);
    const ok = await paid(row.id, { unitAmount: amount, currency, store });
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      title={t("shopping.price.title", { unit: unitLabel })}
      content={
        <Flex vertical gap={8} style={{ width: 260 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Select<Currency> aria-label={t("prices.currency")} value={currency} onChange={setCurrency} options={CURRENCIES.map((code) => ({ value: code, label: code }))} style={{ width: 84 }} />
            <InputNumber aria-label={t("prices.amount")} autoFocus min={0.01} step={0.01} precision={2} value={amount} onChange={setAmount} onPressEnter={save} style={{ width: "100%" }} />
          </Space.Compact>
          {amount !== null && row.quantity > 1 && (
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("shopping.price.total", { count: row.quantity, amount: format.money(Math.round(amount * 100) * row.quantity, currency) })}
            </Typography.Text>
          )}
          <AutoComplete
            aria-label={t("prices.store")}
            value={store}
            onChange={setStore}
            placeholder={t("prices.storePlaceholder")}
            options={(stores ?? []).map((value) => ({ value }))}
            filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {row.inventoryItemId ? t("shopping.price.hint") : t("shopping.price.hintFree")}
          </Typography.Text>
          <Button type="primary" block loading={saving} disabled={!amount} onClick={save}>
            {t("shopping.price.save")}
          </Button>
        </Flex>
      }
    >
      {/* En el celular, sin precio cargado: solo el ícono (con su nombre accesible y tooltip). */}
      <Tooltip title={screens.sm || row.paidCents !== undefined ? undefined : t("shopping.price.button")}>
        <Button size="small" type={row.paidCents !== undefined ? "text" : "default"} icon={<PriceTag />} aria-label={t("shopping.price.button")}>
          {(screens.sm || row.paidCents !== undefined) && label}
        </Button>
      </Tooltip>
    </Popover>
  );
}

/** Precio estimado por unidad para lo que no tiene historial (presupuestar "porcelanato" antes de comprarlo). */
export function EstimatePrice({ row, currency }: { row: ShoppingRow; currency: Currency }) {
  const { t, format } = useI18n();
  const { setEstimate } = useShoppingActions();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(row.estimateCents !== undefined ? row.estimateCents / 100 : null);
  const unitLabel = isUnit(row.unit) ? t(`inventory.units.${row.unit}`, { count: 1 }) : row.unit;

  async function save(value: number | null) {
    if ((await setEstimate(row.id, value)) !== null) setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      title={t("shopping.estimate.title", { unit: unitLabel, currency })}
      content={
        <Flex vertical gap={8} style={{ width: 220 }}>
          <InputNumber aria-label={t("shopping.estimate.title", { unit: unitLabel, currency })} autoFocus min={0} step={1} precision={2} value={amount} onChange={setAmount} onPressEnter={() => save(amount)} style={{ width: "100%" }} prefix={currency} />
          <Flex gap={8}>
            {row.estimateCents !== undefined && (
              <Button onClick={() => save(null)} style={{ flex: 1 }}>
                {t("shopping.estimate.clear")}
              </Button>
            )}
            <Button type="primary" onClick={() => save(amount)} style={{ flex: 1 }}>
              {t("shopping.estimate.save")}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Button type="link" size="small" icon={<Calculator />} style={{ paddingInline: 0, height: "auto" }}>
        {row.estimateCents !== undefined ? t("shopping.approx", { amount: format.money(row.estimateCents * row.quantity, currency) }) : t("shopping.estimate.add")}
      </Button>
    </Popover>
  );
}
