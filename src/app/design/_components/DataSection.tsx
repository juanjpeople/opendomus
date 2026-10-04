"use client";

import { Button, Col, Flex, Popconfirm, Row, Table, Typography, type TableColumnsType } from "antd";
import { PackageOpen, Pencil, Refrigerator, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { Can } from "@/components/auth/Can";
import { EmptyState, IconTile, PageHeader, QuantityStepper, StockTag } from "@/components/ui";
import { getStockStatus, STOCK_STATUS_META, type InventoryItem } from "@/features/inventory/domain";
import { useT } from "@/i18n";
import { usePermission } from "@/lib/auth/hooks";
import { DemoBlock, DemoLabel } from "./DemoBlock";

type DemoItem = Pick<InventoryItem, "id" | "name" | "quantity" | "minThreshold" | "unit">;

const SAMPLE_ITEMS: DemoItem[] = [
  { id: "1", name: "Arroz", quantity: 4, minThreshold: 2, unit: "paquetes" },
  { id: "2", name: "Aceite de oliva", quantity: 1, minThreshold: 2, unit: "litros" },
  { id: "3", name: "Yerba", quantity: 0, minThreshold: 1, unit: "kg" },
  { id: "4", name: "Taladro percutor", quantity: 1, minThreshold: 1, unit: "unidades" },
];

export function DataSection() {
  const t = useT();
  const [items, setItems] = useState(SAMPLE_ITEMS);
  const canAdjust = usePermission("inventory.adjust");

  const step = (id: string, delta: number) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)));
  const remove = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const columns: TableColumnsType<DemoItem> = [
    { title: "Ítem", dataIndex: "name", render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    {
      title: "Estado",
      key: "status",
      render: (_, item) => <StockTag status={getStockStatus(item)} />,
      filters: (Object.keys(STOCK_STATUS_META) as (keyof typeof STOCK_STATUS_META)[]).map((value) => ({ text: t(`inventory.stock.${value}`), value })),
      onFilter: (value, item) => getStockStatus(item) === value,
    },
    {
      title: "Cantidad",
      key: "quantity",
      sorter: (a, b) => a.quantity - b.quantity,
      render: (_, item) => (
        <QuantityStepper value={item.quantity} unit={item.unit} onStep={canAdjust ? (d) => step(item.id, d) : undefined} />
      ),
    },
    {
      title: "Acciones",
      key: "actions",
      align: "right",
      render: (_, item) => (
        <Flex gap={4} justify="flex-end">
          <Can perform="inventory.adjust" fallback="disable" reason="Tu perfil no puede editar">
            {(disabled) => <Button type="text" aria-label="Editar" icon={<Pencil />} disabled={disabled} />}
          </Can>
          <Can perform="inventory.delete">
            <Popconfirm title={`¿Eliminar "${item.name}"?`} okButtonProps={{ danger: true }} onConfirm={() => remove(item.id)}>
              <Button type="text" danger aria-label="Eliminar" icon={<Trash2 />} />
            </Popconfirm>
          </Can>
        </Flex>
      ),
    },
  ];

  return (
    <>
      <DemoBlock
        id="tablas"
        title="Tablas"
        description="Estándar para listados. El estado se calcula con getStockStatus (dominio) y se muestra con StockTag: probá cambiar cantidades. Las acciones se protegen con <Can>."
        code={`
const columns: TableColumnsType<InventoryItem> = [
  { title: "Estado", key: "status", render: (_, item) => <StockTag status={getStockStatus(item)} /> },
  {
    title: "Acciones",
    key: "actions",
    render: (_, item) => (
      <Can perform="inventory.delete">
        <Popconfirm title="¿Eliminar?" onConfirm={() => remove(item.id)}>
          <Button type="text" danger aria-label="Eliminar" icon={<Trash2 />} />
        </Popconfirm>
      </Can>
    ),
  },
];

<Table rowKey="id" columns={columns} dataSource={items} pagination={false} scroll={{ x: true }} />
`}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={false}
          scroll={{ x: true }}
          footer={
            items !== SAMPLE_ITEMS
              ? () => (
                  <Button type="link" size="small" onClick={() => setItems(SAMPLE_ITEMS)} style={{ padding: 0 }}>
                    Restaurar datos de ejemplo
                  </Button>
                )
              : undefined
          }
        />
      </DemoBlock>

      <DemoBlock
        id="componentes"
        title="Componentes propios (@/components/ui)"
        description="Piezas reutilizables de la app. Antes de crear un componente nuevo, revisá si ya existe acá."
        code={`
import { EmptyState, IconTile, PageHeader, QuantityStepper, StockTag } from "@/components/ui";

<PageHeader eyebrow="Inventario" title="Alacena" description="..." extra={<Button>Exportar</Button>} />
<IconTile icon={Wrench} />            {/* solid para destacado */}
<EmptyState icon={PackageOpen} title="Sin ítems" description="..." action={<Button>Agregar</Button>} />
<StockTag status={getStockStatus(item)} />
<QuantityStepper value={item.quantity} unit={item.unit} onStep={(delta) => adjust(item.id, delta)} />
<QuantityStepper value={3} unit="kg" />   {/* solo lectura */}
`}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <DemoLabel>PageHeader</DemoLabel>
            <PageHeader
              title="Título de página"
              description="Descripción breve de la sección."
              extra={<Button type="primary">Acción</Button>}
            />
          </Col>
          <Col xs={24} md={12}>
            <DemoLabel>StockTag</DemoLabel>
            <Flex gap={8}>
              <StockTag status="ok" />
              <StockTag status="low" />
              <StockTag status="empty" />
            </Flex>
          </Col>
          <Col xs={24} md={12}>
            <DemoLabel>QuantityStepper (editable / solo lectura)</DemoLabel>
            <Flex gap={16}>
              <QuantityStepper value={items[0]?.quantity ?? 0} unit="paquetes" onStep={(d) => step("1", d)} />
              <QuantityStepper value={3} unit="kg" />
            </Flex>
          </Col>
          <Col xs={24} md={12}>
            <DemoLabel>IconTile (normal / solid)</DemoLabel>
            <Flex gap={12}>
              <IconTile icon={Refrigerator} />
              <IconTile icon={Wrench} solid />
            </Flex>
          </Col>
          <Col xs={24}>
            <DemoLabel>EmptyState</DemoLabel>
            <EmptyState
              icon={PackageOpen}
              title="Todavía no hay productos"
              description="Cargá el primero y OpenDomus te avisa cuando quede poco."
              action={<Button type="primary">Agregar</Button>}
            />
          </Col>
        </Row>
      </DemoBlock>
    </>
  );
}
