"use client";

import { App, Button, Col, Collapse, Form, Input, InputNumber, Row, Segmented, Select, Space, Switch, theme } from "antd";
import { INVENTORY_LIMITS, UNITS } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { DemoBlock } from "./DemoBlock";

interface DemoValues {
  name: string;
  kind: "fridge" | "pantry" | "toolbox";
  quantity: number;
  unit: string;
  tags?: string[];
  notes?: string;
  notify: boolean;
}

export function FormsSection() {
  const t = useT();
  const [form] = Form.useForm<DemoValues>();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  return (
    <DemoBlock
      id="formularios"
      title="Formularios"
      description='Layout vertical, grilla responsive (Row/Col), validación declarativa con rules y requiredMark={false} (sin asteriscos ni marcas: si un campo es opcional, lo dice el placeholder o la ayuda). Los límites salen del dominio, así la UI y el servicio validan lo mismo. Lo opcional que tiene un buen valor por defecto se pliega con Collapse ghost. Usá forceRender: el formulario conserva esos valores aunque nadie abra la sección. Así se pliegan el color y el ícono de recintos y contenedores.'
      code={`
<Form form={form} layout="vertical" requiredMark={false} onFinish={handleFinish}>
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
  <Collapse ghost items={[{ key: "more", label: "Más detalles", forceRender: true, children: optionalFields }]} />
</Form>
`}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ kind: "pantry", quantity: 1, unit: "unidades", notify: true }}
        onFinish={(values) => message.success(`Formulario válido: ${values.name}`)}
        onFinishFailed={() => message.error("Revisá los campos marcados")}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Nombre"
              rules={[
                { required: true, whitespace: true, message: "Ingresá un nombre." },
                { max: INVENTORY_LIMITS.nameMaxLength },
              ]}
            >
              <Input placeholder="Ej. Arroz" maxLength={INVENTORY_LIMITS.nameMaxLength} showCount />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="kind" label="Contenedor">
              <Segmented
                block
                options={(["fridge", "pantry", "toolbox"] as const).map((value) => ({ value, label: t(`storage.containerKinds.${value}`) }))}
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
              <Select options={UNITS.map((unit) => ({ value: unit, label: t(`inventory.units.${unit}`, { count: 2 }) }))} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="notify" label="Avisar cuando haya stock bajo" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Collapse
          ghost
          style={{ marginBottom: token.margin }}
          styles={{ header: { paddingInline: 0 }, body: { paddingInline: 0 } }}
          items={[{
            key: "more",
            label: "Más detalles",
            forceRender: true,
            children: (
              <Row gutter={16}>
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
              </Row>
            ),
          }]}
        />
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
