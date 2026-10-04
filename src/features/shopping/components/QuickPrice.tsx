"use client";

import { AutoComplete, Button, Flex, Grid, InputNumber, Popover, Select, Space, Tooltip, Typography, theme } from "antd";
import { Tag as PriceTag } from "lucide-react";
import { useState } from "react";
import { isUnit } from "@/features/inventory/domain";
import { CURRENCIES, defaultCurrencyFor, type Currency, type PriceSummary } from "@/features/prices/domain";
import { useKnownStores, usePriceActions } from "@/features/prices/hooks";
import { useI18n } from "@/i18n";

interface QuickPriceProps {
  itemId: string;
  unit: string;
  /** Último precio conocido: arranca con su moneda, su tienda y su valor (lo más probable es que se repita). */
  price?: PriceSummary;
}

/** "¿Cuánto salió?" justo después de comprar: alimenta el historial de precios (y, más adelante, las cuentas). */
export function QuickPrice({ itemId, unit, price }: QuickPriceProps) {
  const { t, locale } = useI18n();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const stores = useKnownStores();
  const { add } = usePriceActions();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(price ? price.latest.amountCents / 100 : null);
  const [currency, setCurrency] = useState<Currency>(price?.latest.currency ?? defaultCurrencyFor(locale));
  const [store, setStore] = useState(price?.latest.store ?? "");
  const [saving, setSaving] = useState(false);
  const unitLabel = isUnit(unit) ? t(`inventory.units.${unit}`, { count: 1 }) : unit;

  async function save() {
    if (!amount) return;
    setSaving(true);
    const ok = await add({ itemId, amount, currency, store, at: Date.now() });
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
          <AutoComplete
            aria-label={t("prices.store")}
            value={store}
            onChange={setStore}
            placeholder={t("prices.storePlaceholder")}
            options={(stores ?? []).map((value) => ({ value }))}
            filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
          />
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("shopping.price.hint")}
          </Typography.Text>
          <Button type="primary" block loading={saving} disabled={!amount} onClick={save}>
            {t("prices.add")}
          </Button>
        </Flex>
      }
    >
      {/* En el celular, solo el ícono (con su nombre accesible y tooltip). */}
      <Tooltip title={screens.sm ? undefined : t("shopping.price.button")}>
        <Button size="small" icon={<PriceTag />} aria-label={t("shopping.price.button")}>
          {screens.sm && t("shopping.price.button")}
        </Button>
      </Tooltip>
    </Popover>
  );
}
