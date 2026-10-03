"use client";

import { Typography } from "antd";
import { InventoryForm } from "@/components/common/InventoryForm";
import { InventoryList } from "@/components/common/InventoryList";

const { Title } = Typography;

export default function AlacenaPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>Alacena</Title>
      <InventoryForm inventoryType="alacena" title="Agregar Producto" />
      <InventoryList inventoryType="alacena" title="Inventario Actual" />
    </div>
  );
}
