"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { getStockStatus, type InventoryType, type NewInventoryItem } from "./domain";
import { adjustInventoryQuantity, createInventoryItem, deleteInventoryItem } from "./service";

/** Ítems de un inventario, reactivos a cambios en la base. `undefined` mientras carga. */
export function useInventoryItems(type: InventoryType) {
  return useLiveQuery(() => db.inventory.where("inventoryType").equals(type).sortBy("name"), [type]);
}

export function useInventorySummary(type: InventoryType) {
  return useLiveQuery(async () => {
    const items = await db.inventory.where("inventoryType").equals(type).toArray();
    return {
      total: items.length,
      needsAttention: items.filter((item) => getStockStatus(item) !== "ok").length,
    };
  }, [type]);
}

/**
 * Acciones ligadas al usuario actual. Muestran el error al usuario y devuelven
 * `true`/`false` para que el componente decida (ej. limpiar el formulario).
 */
export function useInventoryActions(type: InventoryType) {
  const user = useCurrentUser();
  const { message } = App.useApp();

  async function run(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) message.success(successMessage);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error));
      return false;
    }
  }

  return {
    create: (input: NewInventoryItem) => run(() => createInventoryItem(user, type, input), "Ítem agregado"),
    adjust: (id: string, delta: number) => run(() => adjustInventoryQuantity(user, id, delta)),
    remove: (id: string) => run(() => deleteInventoryItem(user, id), "Ítem eliminado"),
  };
}
