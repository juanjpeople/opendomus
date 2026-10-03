"use client";

import { Typography } from "antd";
import { InventoryForm } from "@/components/common/InventoryForm";
import { InventoryList } from "@/components/common/InventoryList";

const { Title } = Typography;

export default function TallerPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={2}>Taller</Title>
      <InventoryForm inventoryType="taller" title="Agregar Herramienta" />
      <InventoryList inventoryType="taller" title="Inventario del Taller" />
    </div>
  );
}
