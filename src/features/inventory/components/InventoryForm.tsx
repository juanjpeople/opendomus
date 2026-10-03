"use client";

import { Button, Card, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { Plus } from "lucide-react";
import { useState } from "react";
import { INVENTORY_LIMITS, INVENTORY_TYPES, type InventoryType, type NewInventoryItem } from "../domain";
import { useInventoryActions } from "../hooks";

const DEFAULT_VALUES: Omit<NewInventoryItem, "name"> = { quantity: 1, unit: "unidades", minThreshold: 1 };

export function InventoryForm({ type }: { type: InventoryType }) {
  const [form] = Form.useForm<NewInventoryItem>();
  const [saving, setSaving] = useState(false);
  const { create } = useInventoryActions(type);
  const config = INVENTORY_TYPES[type];

  async function handleFinish(values: NewInventoryItem) {
    setSaving(true);
    const ok = await create(values);
    setSaving(false);
    if (ok) form.resetFields();
  }

  return (
    <Card title={`Agregar ${config.itemNoun}`} style={{ marginBottom: 24 }}>
      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={DEFAULT_VALUES} requiredMark="optional">
        <Row gutter={16} align="bottom">
          <Col xs={24} md={10}>
            <Form.Item
              name="name"
              label="Nombre"
              rules={[
                { required: true, whitespace: true, message: "Ingresá un nombre" },
                { max: INVENTORY_LIMITS.nameMaxLength },
              ]}
            >
              <Input placeholder={`Ej. ${type === "alacena" ? "Arroz" : "Taladro"}`} maxLength={INVENTORY_LIMITS.nameMaxLength} />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item name="quantity" label="Cantidad" rules={[{ required: true, message: "Requerido" }]}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item name="minThreshold" label="Mínimo" tooltip="Por debajo de este valor se marca como stock bajo">
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={3}>
            <Form.Item name="unit" label="Unidad">
              <Select options={config.units.map((unit) => ({ value: unit, label: unit }))} />
            </Form.Item>
          </Col>
          <Col xs={12} md={3}>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<Plus />} loading={saving} block>
                Agregar
              </Button>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}
