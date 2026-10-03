"use client";

import { Form, Input, InputNumber, Select, Button, Space, Card } from "antd";
import { db } from "@/lib/db";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  inventoryType: 'alacena' | 'taller';
  title: string;
}

export function InventoryForm({ inventoryType, title }: Props) {
  const [form] = Form.useForm();
  const { currentUser } = useAppStore();

  const handleAddItem = async (values: any) => {
    // Control de seguridad: Niños no pueden agregar inventario
    if (currentUser?.role === 'kid') {
      return;
    }

    await db.inventory.add({
      id: crypto.randomUUID(),
      name: values.name,
      inventoryType,
      quantity: values.quantity || 1,
      unit: values.unit || 'unidades',
      minThreshold: values.minThreshold || 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    form.resetFields();
  };

  // UI dinámica según rol: Los niños ni siquiera ven el formulario
  if (currentUser?.role === 'kid') return null;

  const unitOptions = inventoryType === 'alacena' 
    ? ['unidades', 'kg', 'gr', 'litros', 'paquetes']
    : ['unidades', 'cajas', 'metros', 'litros'];

  return (
    <Card title={title} styles={{ body: { padding: 24 } }} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16 }}>
      <Form 
        form={form} 
        layout="vertical" 
        onFinish={handleAddItem}
        initialValues={{ quantity: 1, unit: 'unidades', minThreshold: 1 }}
      >
        <Space align="end" wrap>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej. Producto" size="large" />
          </Form.Item>
          <Form.Item name="quantity" label="Cantidad">
            <InputNumber min={0} size="large" />
          </Form.Item>
          <Form.Item name="unit" label="Unidad">
            <Select style={{ width: 120 }} size="large">
              {unitOptions.map(u => <Select.Option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large">Guardar</Button>
          </Form.Item>
        </Space>
      </Form>
    </Card>
  );
}
