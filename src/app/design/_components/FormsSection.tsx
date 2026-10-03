"use client";

import { App, Button, Col, Form, Input, InputNumber, Row, Segmented, Select, Space, Switch } from "antd";
import { INVENTORY_LIMITS, INVENTORY_TYPES } from "@/features/inventory/domain";
import { DemoBlock } from "./DemoBlock";

interface DemoValues {
  name: string;
  inventory: "alacena" | "taller";
  quantity: number;
  unit: string;
  tags?: string[];
  notes?: string;
  notify: boolean;
}

export function FormsSection() {
  const [form] = Form.useForm<DemoValues>();
  const { message } = App.useApp();
  const inventory = Form.useWatch("inventory", form) ?? "alacena";

  return (
    <DemoBlock
      id="formularios"
      title="Formularios"
      description='Layout vertical, grilla responsive (Row/Col), validación declarativa con rules y requiredMark="optional" (se marcan los opcionales, no los obligatorios). Los límites salen del dominio, así la UI y el servicio validan lo mismo.'
      code={`
<Form form={form} layout="vertical" requiredMark="optional" onFinish={handleFinish}>
  <Row gutter={16}>
    <Col xs={24} md={12}>
      <Form.Item
        name="name"
        label="Nombre"
        rules={[{ required: true, whitespace: true }, { max: INVENTORY_LIMITS.nameMaxLength }]}
      >
        <Input />
      </Form.Item>
    </Col>
  </Row>
</Form>
`}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ inventory: "alacena", quantity: 1, unit: "unidades", notify: true }}
        onFinish={(values) => message.success(`Formulario válido: ${values.name}`)}
        onFinishFailed={() => message.error("Revisá los campos marcados")}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Nombre"
              rules={[
                { required: true, whitespace: true, message: "Ingresá un nombre" },
                { max: INVENTORY_LIMITS.nameMaxLength },
              ]}
            >
              <Input placeholder="Ej. Arroz" maxLength={INVENTORY_LIMITS.nameMaxLength} showCount />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="inventory" label="Inventario">
              <Segmented
                block
                options={Object.entries(INVENTORY_TYPES).map(([value, { label }]) => ({ value, label }))}
                onChange={() => form.setFieldValue("unit", "unidades")}
              />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="quantity" label="Cantidad" rules={[{ required: true, message: "Requerido" }]}>
              <InputNumber min={0} max={INVENTORY_LIMITS.maxQuantity} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="unit" label="Unidad">
              <Select options={INVENTORY_TYPES[inventory].units.map((unit) => ({ value: unit, label: unit }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="tags" label="Etiquetas">
              <Select
                mode="tags"
                placeholder="Escribí y presioná Enter"
                options={["Desayuno", "Limpieza", "Urgente"].map((tag) => ({ value: tag, label: tag }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notes" label="Notas">
              <Input.TextArea rows={2} placeholder="Marca preferida, dónde se guarda…" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notify" label="Avisar cuando haya stock bajo" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Space>
          <Button type="primary" htmlType="submit">
            Guardar
          </Button>
          <Button htmlType="reset">Limpiar</Button>
        </Space>
      </Form>
    </DemoBlock>
  );
}
