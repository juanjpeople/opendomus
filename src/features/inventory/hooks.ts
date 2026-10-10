"use client";

import { App } from "antd";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { forecastUsage, needsRestock, USAGE_WINDOW_DAYS, type InventoryItem, type InventoryItemPatch, type NewInventoryItem, type UsageForecast } from "./domain";
import { adjustInventoryQuantity, consumeInventoryItem, createInventoryItem, deleteInventoryItem, undoQuantityChange, updateInventoryItem } from "./service";

/** Productos de un contenedor, reactivos a cambios en la base. `undefined` mientras carga. */
export function useInventoryItems(containerId: string) {
  return useLiveQuery(() => db.inventory.where("containerId").equals(containerId).sortBy("name"), [containerId]);
}

/** Todos los productos de la casa, por nombre (para la búsqueda global). */
export function useAllInventoryItems() {
  return useLiveQuery(() => db.inventory.orderBy("name").toArray());
}

export function useInventoryItem(id: string | null) {
  return useLiveQuery(async () => (id ? ((await db.inventory.get(id)) ?? null) : null), [id]);
}

/** Totales de toda la casa (para el inicio). */
export function useInventoryTotals() {
  return useLiveQuery(async () => {
    const items = await db.inventory.toArray();
    return { total: items.length, needsAttention: items.filter(needsRestock).length };
  });
}

const DAY = 86_400_000;

/** Cuánto se consumió de un producto en los últimos 30 días y cuándo fue la última vez (sale del historial). */
export function useConsumption(itemId: string | null) {
  return useLiveQuery(async () => {
    if (!itemId) return null;
    const since = Date.now() - 30 * DAY;
    const entries = await db.activity
      .where("[entityId+at]")
      .between([itemId, since], [itemId, Dexie.maxKey])
      .filter((entry) => entry.action === "consume" && entry.undoneAt === undefined)
      .toArray();
    return {
      last30: entries.reduce((sum, entry) => sum + ((entry.from ?? 0) - (entry.to ?? 0)), 0),
      times: entries.length,
      lastAt: entries.at(-1)?.at ?? null,
    };
  }, [itemId]);
}

export interface ItemUsage extends UsageForecast {
  item: InventoryItem;
}

/**
 * Lo que más se usó en los últimos 30 días (sale del historial de consumos) y cuánto alcanza lo
 * que queda a ese ritmo. Solo insumos que todavía existen; los más usados primero.
 */
export function useTopUsage(limit = 5) {
  return useLiveQuery(async () => {
    const now = Date.now();
    const since = now - USAGE_WINDOW_DAYS * DAY;
    const [entries, items] = await Promise.all([
      db.activity.where("at").above(since).filter((entry) => entry.module === "inventory" && entry.action === "consume" && entry.undoneAt === undefined).toArray(),
      db.inventory.toArray(),
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));
    const uses = new Map<string, { at: number; amount: number }[]>();
    for (const entry of entries) {
      if (!byId.has(entry.entityId)) continue;
      uses.set(entry.entityId, [...(uses.get(entry.entityId) ?? []), { at: entry.at, amount: (entry.from ?? 0) - (entry.to ?? 0) }]);
    }
    return [...uses]
      .flatMap(([id, list]): ItemUsage[] => {
        const item = byId.get(id)!;
        if (item.reusable) return [];
        const forecast = forecastUsage(item.quantity, list, now);
        return forecast.used ? [{ item, ...forecast }] : [];
      })
      .sort((a, b) => b.times - a.times || b.used - a.used || a.item.name.localeCompare(b.item.name))
      .slice(0, limit);
  }, [limit]);
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
    /** Devuelve el resultado (cuánto se descontó, cuánto faltó y la entrada del historial) o `null` si falló. */
    consume: async (id: string, amount = 1) => {
      try {
        return await consumeInventoryItem(user, id, amount);
      } catch (error) {
        message.error(getErrorMessage(error, t));
        return null;
      }
    },
    undo: (entryId: string) => run(() => undoQuantityChange(user, entryId), t("activity.undone")),
  };
}
