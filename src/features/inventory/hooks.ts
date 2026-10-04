"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { getStockStatus, type InventoryItemPatch, type NewInventoryItem } from "./domain";
import { adjustInventoryQuantity, createInventoryItem, deleteInventoryItem, updateInventoryItem } from "./service";

/** Productos de un contenedor, reactivos a cambios en la base. `undefined` mientras carga. */
export function useInventoryItems(containerId: string) {
  return useLiveQuery(() => db.inventory.where("containerId").equals(containerId).sortBy("name"), [containerId]);
}

export function useInventoryItem(id: string | null) {
  return useLiveQuery(async () => (id ? ((await db.inventory.get(id)) ?? null) : null), [id]);
}

/** Totales de toda la casa (para el inicio). */
export function useInventoryTotals() {
  return useLiveQuery(async () => {
    const items = await db.inventory.toArray();
    return { total: items.length, needsAttention: items.filter((item) => getStockStatus(item) !== "ok").length };
  });
}

/**
 * Acciones ligadas al usuario actual. Muestran el error al usuario y devuelven
 * `true`/`false` para que el componente decida (ej. limpiar el formulario).
 */
export function useInventoryActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>, successMessage?: string) {
    try {
      await action();
      if (successMessage) message.success(successMessage);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  return {
    create: (containerId: string, input: NewInventoryItem) =>
      run(() => createInventoryItem(user, containerId, input), t("inventory.toast.created")),
    adjust: (id: string, delta: number) => run(() => adjustInventoryQuantity(user, id, delta)),
    update: (id: string, patch: InventoryItemPatch) => run(() => updateInventoryItem(user, id, patch), t("inventory.toast.saved")),
    remove: (id: string) => run(() => deleteInventoryItem(user, id), t("inventory.toast.deleted")),
  };
}
