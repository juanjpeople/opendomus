"use client";

import { Col, Form, Input, InputNumber, Modal, Row, Select, Switch, theme } from "antd";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { INVENTORY_LIMITS, UNITS, type NewInventoryItem } from "../domain";
import { useInventoryActions } from "../hooks";
import { CatalogPicker } from "./CatalogPicker";

const DEFAULT_VALUES: Omit<NewInventoryItem, "name"> = { quantity: 1, unit: "unidades", minThreshold: 1, autoSuggest: true, reusable: false };

/**
 * Alta de un producto en un contenedor. Va en un diálogo para que la página muestre primero lo
 * que hay; el catálogo completa el formulario y se confirma con Agregar.
 */
export function ProductModal({ containerId, place, open, onClose }: { containerId: string; place: string; open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<NewInventoryItem>();
  const [saving, setSaving] = useState(false);
  const { create } = useInventoryActions();
  const t = useT();
  const { token } = theme.useToken();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  async function submit() {
    const values = await form.validateFields();
    setSaving(true);
    const ok = await create(containerId, values);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={t("inventory.form.titleIn", { place })}
      onCancel={onClose}
      onOk={submit}
      okText={t("inventory.form.submit")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      width={token.screenSM + token.paddingLG * 4}
      destroyOnHidden
    >
      <div style={{ marginBottom: token.margin }}>
        <CatalogPicker onSelect={(values) => form.setFieldsValue(values)} />
      </div>
      <Form form={form} name={`product-${containerId}`} layout="vertical" onFinish={() => submit()} initialValues={DEFAULT_VALUES} requiredMark={false} disabled={saving}>
        <Form.Item
          name="name"
          label={t("inventory.form.name")}
          rules={[
            { required: true, whitespace: true, message: t("errors.validation.nameRequired") },
            { max: INVENTORY_LIMITS.nameMaxLength },
          ]}
        >
          <Input autoFocus placeholder={t("inventory.form.namePlaceholder")} maxLength={INVENTORY_LIMITS.nameMaxLength} />
        </Form.Item>
        <Row gutter={token.margin}>
          <Col xs={12} sm={8}>
            <Form.Item name="quantity" label={t("inventory.form.quantity")} rules={[{ required: true, message: t("inventory.form.required") }]}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="minThreshold" label={t("inventory.form.min")} tooltip={t("inventory.form.minTooltip")} extra={t("inventory.form.minHelp")}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="unit" label={t("inventory.form.unit")}>
              <Select options={UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={token.margin}>
          <Col xs={24} sm={12}>
            <Form.Item name="reusable" valuePropName="checked" label={t("inventory.item.reusable")} tooltip={t("inventory.item.reusableHint")}>
              <Switch onChange={(checked) => { if (checked) form.setFieldsValue({ autoSuggest: false, minThreshold: 0 }); }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="autoSuggest" valuePropName="checked" label={t("inventory.item.autoSuggest")} tooltip={t("inventory.item.autoSuggestHint")}>
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        {/* Enter en un campo guarda, como en el resto de los formularios. */}
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}
