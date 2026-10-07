"use client";

import { Button, Card, Col, Form, Input, InputNumber, Row, Select, Switch, theme } from "antd";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n";
import { INVENTORY_LIMITS, UNITS, type NewInventoryItem } from "../domain";
import { useInventoryActions } from "../hooks";
import { CatalogPicker } from "./CatalogPicker";

const DEFAULT_VALUES: Omit<NewInventoryItem, "name"> = { quantity: 1, unit: "unidades", minThreshold: 1, autoSuggest: true, reusable: false };

export function InventoryForm({ containerId }: { containerId: string }) {
  const [form] = Form.useForm<NewInventoryItem>();
  const [saving, setSaving] = useState(false);
  const { create } = useInventoryActions();
  const t = useT();
  const { token } = theme.useToken();

  async function handleFinish(values: NewInventoryItem) {
    setSaving(true);
    const ok = await create(containerId, values);
    setSaving(false);
    if (ok) form.resetFields();
  }

  return (
    <Card title={t("inventory.form.title")} style={{ marginBottom: token.marginLG }}>
      <div style={{ marginBottom: token.margin }}><CatalogPicker onSelect={(values) => form.setFieldsValue(values)} /></div>
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={DEFAULT_VALUES} requiredMark="optional" disabled={saving}>
        <Row gutter={16} align="bottom">
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={t("inventory.form.name")}
              rules={[
                { required: true, whitespace: true, message: t("errors.validation.nameRequired") },
                { max: INVENTORY_LIMITS.nameMaxLength },
              ]}
            >
              <Input placeholder={t("inventory.form.namePlaceholder")} maxLength={INVENTORY_LIMITS.nameMaxLength} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item name="quantity" label={t("inventory.form.quantity")} rules={[{ required: true, message: t("inventory.form.required") }]}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item name="minThreshold" label={t("inventory.form.min")} tooltip={t("inventory.form.minTooltip")}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Form.Item name="unit" label={t("inventory.form.unit")}>
              <Select options={UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }))} />
            </Form.Item>
          </Col>

        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={12}><Form.Item name="reusable" valuePropName="checked" label={t("inventory.item.reusable")} tooltip={t("inventory.item.reusableHint")}>
            <Switch onChange={(checked) => { if (checked) form.setFieldsValue({ autoSuggest: false, minThreshold: 0 }); }} />
          </Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item name="autoSuggest" valuePropName="checked" label={t("inventory.item.autoSuggest")} tooltip={t("inventory.item.autoSuggestHint")}>
            <Switch />
          </Form.Item></Col>
        </Row>
        <Button type="primary" htmlType="submit" icon={<Plus />} loading={saving}>{t("inventory.form.submit")}</Button>
      </Form>
    </Card>
  );
}
