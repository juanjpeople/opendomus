"use client";

import { Flex, Typography } from "antd";
import { useState } from "react";
import { Callout, FilterChips } from "@/components/ui";
import { CatalogPicker } from "@/features/inventory/components/CatalogPicker";
import type { NewInventoryItem } from "@/features/inventory/domain";
import { DemoBlock, DemoLabel } from "./DemoBlock";

export function CatalogSection() {
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState<NewInventoryItem | null>(null);
  return <DemoBlock id="flujo-catalogo" title="Catálogo: filtrar, consultar y elegir" description="FilterChips deja visibles los rubros y marca el filtro activo con aria-pressed. VisualTile muestra cada producto. El precio de referencia se consulta en un popover separado: abrirlo no selecciona el producto. Elegir completa el formulario y avisa; no crea existencias. Este recorrido usa el catálogo real, sin guardar datos.">
    <Flex vertical gap={16}>
      <DemoLabel>FilterChips · Tab, Enter y Espacio</DemoLabel>
      <FilterChips label="Rubros de ejemplo" value={filter} onChange={setFilter} options={[{ value: "all", label: "Todos los rubros" }, { value: "food", label: "Almacén y cocina", color: "green" }, { value: "tools", label: "Herramientas", color: "purple" }]} />
      <DemoLabel>Flujo real · búsqueda, categorías y referencias</DemoLabel>
      <CatalogPicker onSelect={setSelection} />
      {selection && <Callout title={selection.name}><Typography.Text>{selection.quantity} · {selection.unit}</Typography.Text></Callout>}
    </Flex>
  </DemoBlock>;
}
