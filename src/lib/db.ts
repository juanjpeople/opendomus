import Dexie, { type EntityTable } from "dexie";
import type { InventoryItem } from "@/features/inventory/domain";

/**
 * Base de datos local (IndexedDB). Solo los servicios (`src/features/<x>/service.ts`)
 * deberían importar `db` para escribir; la UI lee a través de hooks.
 *
 * Cambios de esquema: NUNCA editar una versión existente. Agregar `db.version(n + 1)`
 * con el esquema nuevo y, si hace falta, un `.upgrade()` que migre los datos.
 */

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isCompleted: boolean;
  /** Si vino automáticamente del inventario. */
  inventoryItemId?: string;
  createdAt: number;
}

export const db = new Dexie("OpenDomusDB") as Dexie & {
  inventory: EntityTable<InventoryItem, "id">;
  shoppingList: EntityTable<ShoppingListItem, "id">;
};

// Solo se declaran los campos indexados (los usados en `where`/`orderBy`).
db.version(1).stores({
  inventory: "id, name, inventoryType, quantity",
  shoppingList: "id, name, isCompleted, inventoryItemId",
});
