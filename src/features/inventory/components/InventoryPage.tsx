"use client";

import { RequirePermission } from "@/components/auth/RequirePermission";
import { Can } from "@/components/auth/Can";
import { PageHeader } from "@/components/ui";
import { INVENTORY_TYPES, type InventoryType } from "../domain";
import { InventoryForm } from "./InventoryForm";
import { InventoryList } from "./InventoryList";

/** Página completa de un inventario. Alacena y Taller son la misma pantalla con otro `type`. */
export function InventoryPage({ type }: { type: InventoryType }) {
  const config = INVENTORY_TYPES[type];

  return (
    <RequirePermission perform="inventory.view">
      <PageHeader title={config.label} description={config.description} />
      <Can perform="inventory.create">
        <InventoryForm type={type} />
      </Can>
      <InventoryList type={type} />
    </RequirePermission>
  );
}
