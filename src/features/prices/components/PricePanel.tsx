"use client";

import { AutoComplete, Button, Col, DatePicker, Dropdown, Flex, Form, InputNumber, Popconfirm, Row, Select, Space, Typography, theme } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Plus, Search, Tag as PriceTag, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { SPRING } from "@/lib/motion";
import { CURRENCIES, defaultCurrencyFor, summarizePrices, type Currency } from "../domain";
import { useKnownStores, usePriceActions, usePrices } from "../hooks";
import { getPriceSearchProviders } from "../search";
import { findCatalogProduct } from "@/features/inventory/catalog";
import { ReferencePrice } from "./ReferencePrice";

interface PriceFormValues {
  amount: number;
  currency: Currency;
  store?: string;
  date: Dayjs;
}

/** Precios de un producto: resumen, registro, historial y comparación online (a pedido). */
export function PricePanel({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { t, format, locale } = useI18n();
  const { token } = theme.useToken();
  const records = usePrices(itemId);
  const stores = useKnownStores();
  const { add, remove } = usePriceActions();
  const canManage = usePermission("prices.manage");
  const [form] = Form.useForm<PriceFormValues>();
  const [saving, setSaving] = useState(false);

  const summary = records ? summarizePrices(records) : null;
  const defaultCurrency = records?.[0]?.currency ?? defaultCurrencyFor(locale);

  async function onFinish(values: PriceFormValues) {
    setSaving(true);
    // Hoy → el instante exacto (así dos precios del mismo día quedan bien ordenados); otro día → su mediodía.
    const at = values.date.isSame(dayjs(), "day") ? Date.now() : values.date.hour(12).minute(0).valueOf();
    const ok = await add({ itemId, amount: values.amount, currency: values.currency, store: values.store ?? "", at });
    setSaving(false);
    if (ok) form.resetFields(["amount"]);
  }

  const providers = getPriceSearchProviders(locale);
  const catalogProduct = findCatalogProduct(itemName);

  return (
    <Flex vertical gap={16}>
      {summary && (
        <Row gutter={12}>
          <Col span={12}>
            <Stat label={t("prices.latest")} value={format.money(summary.latest.amountCents, summary.latest.currency)}>
              {summary.change !== null && summary.change !== 0 && (
                <Typography.Text
                  style={{ fontSize: token.fontSizeSM, color: summary.change > 0 ? token.colorError : token.colorSuccess, display: "inline-flex", gap: 4, alignItems: "center" }}
                >
                  {summary.change > 0 ? <TrendingUp /> : <TrendingDown />}
                  {t("prices.vsPrevious", { value: `${summary.change > 0 ? "+" : ""}${Math.round(summary.change * 100)} %` })}
                </Typography.Text>
              )}
            </Stat>
          </Col>
          <Col span={12}>
            <Stat label={t("prices.cheapest")} value={format.money(summary.cheapest.amountCents, summary.cheapest.currency)}>
              {summary.cheapest.store && (
                <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("prices.atStore", { store: summary.cheapest.store })}
                </Typography.Text>
              )}
            </Stat>
          </Col>
        </Row>
      )}

      {catalogProduct && <ReferencePrice catalogId={catalogProduct.id} />}

      {canManage && (
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ currency: defaultCurrency, date: dayjs() }}
          requiredMark={false}
          key={defaultCurrency}
        >
          <Row gutter={8} align="bottom">
            <Col xs={24} sm={10}>
              <Form.Item label={t("prices.amount")} required>
                <Space.Compact style={{ width: "100%" }}>
                  <Form.Item name="currency" noStyle>
                    <Select aria-label={t("prices.currency")} options={CURRENCIES.map((code) => ({ value: code, label: code }))} style={{ width: 84 }} />
                  </Form.Item>
                  <Form.Item name="amount" noStyle rules={[{ required: true, message: t("inventory.form.required") }]}>
                    <InputNumber aria-label={t("prices.amount")} min={0.01} step={0.01} precision={2} style={{ width: "100%" }} />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={14} sm={8}>
              <Form.Item name="store" label={t("prices.store")}>
                <AutoComplete
                  options={(stores ?? []).map((store) => ({ value: store }))}
                  placeholder={t("prices.storePlaceholder")}
                  filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            </Col>
            <Col xs={10} sm={6}>
              <Form.Item name="date" label={t("prices.date")}>
                <DatePicker allowClear={false} style={{ width: "100%" }} disabledDate={(date) => date.isAfter(dayjs(), "day")} format="DD/MM/YY" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" icon={<Plus />} loading={saving}>
            {t("prices.add")}
          </Button>
        </Form>
      )}

      <div>
        {records && records.length === 0 && <EmptyState icon={PriceTag} title={t("prices.empty")} description={t("prices.emptyText")} />}
        <AnimatePresence initial={false}>
          {records?.map((record) => (
            <motion.div
              key={record.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.snappy}
              style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Flex align="center" justify="space-between" gap={8} style={{ paddingBlock: 8 }}>
                <Flex vertical style={{ minWidth: 0 }}>
                  <Typography.Text strong>{format.money(record.amountCents, record.currency)}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} ellipsis>
                    {format.date(record.at, { day: "numeric", month: "short", year: "numeric" })}
                    {record.store && ` · ${record.store}`}
                  </Typography.Text>
                </Flex>
                <Can perform="prices.manage">
                  <Popconfirm title={t("prices.deleteConfirm")} okButtonProps={{ danger: true }} onConfirm={() => remove(record.id)}>
                    <Button type="text" size="small" danger icon={<Trash2 />} aria-label={t("inventory.list.deleteOk")} />
                  </Popconfirm>
                </Can>
              </Flex>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div>
        <Dropdown
          trigger={["click"]}
          menu={{
            items: providers.map((provider) => ({
              key: provider.id,
              label: (
                <a href={provider.url(itemName)} target="_blank" rel="noopener noreferrer">
                  <Flex align="center" justify="space-between" gap={16}>
                    {provider.name} <ExternalLink />
                  </Flex>
                </a>
              ),
            })),
          }}
        >
          <Button icon={<Search />}>{t("prices.searchOnline")}</Button>
        </Dropdown>
        <Typography.Paragraph type="secondary" style={{ fontSize: token.fontSizeSM, margin: "6px 0 0" }}>
          {t("prices.searchHint")}
        </Typography.Paragraph>
      </div>
    </Flex>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div style={{ padding: 12, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary, height: "100%" }}>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {label}
      </Typography.Text>
      <div style={{ fontSize: token.fontSizeHeading4, fontWeight: 600, letterSpacing: "-0.02em" }}>{value}</div>
      {children}
    </div>
  );
}
