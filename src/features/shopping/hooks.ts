"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import type { InventoryItem } from "@/features/inventory/domain";
import { summarizePrices, type PriceSummary } from "@/features/prices/domain";
import { useT } from "@/i18n";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { SHOPPING_LIMITS, suggestedQuantity, type NewShoppingItem, type ShoppingCandidate, type ShoppingListItem } from "./domain";
import { addShoppingItem, clearBought, confirmSuggestions, dismissSuggestion, markBought, removeShoppingItem, setShoppingQuantity, unmarkBought } from "./service";

/** Dónde está guardado un producto ("Cocina › Heladera"), para ubicarlo en la lista. */
export interface ItemPlace {
  item: InventoryItem;
  place: string;
}

export interface ShoppingRow extends ShoppingListItem {
  /** Producto vinculado y su lugar (si sigue existiendo). */
  linked?: ItemPlace;
  price?: PriceSummary;
}

export interface CandidateRow extends ShoppingCandidate {
  linked: ItemPlace;
  suggested: number;
  price?: PriceSummary;
}

export interface ShoppingData {
  pending: ShoppingRow[];
  bought: ShoppingRow[];
  candidates: CandidateRow[];
  prices: Map<string, PriceSummary>;
}

async function placesOf(itemIds: string[]) {
  const items = (await db.inventory.bulkGet(itemIds)).filter((item): item is InventoryItem => !!item);
  const containers = await db.containers.bulkGet([...new Set(items.map((item) => item.containerId))]);
  const spaces = await db.spaces.bulkGet([...new Set(containers.flatMap((container) => (container ? [container.spaceId] : [])))]);
  const containerById = new Map(containers.flatMap((container) => (container ? [[container.id, container] as const] : [])));
  const spaceById = new Map(spaces.flatMap((space) => (space ? [[space.id, space] as const] : [])));
  return new Map(
    items.map((item) => {
      const container = containerById.get(item.containerId);
      const space = container ? spaceById.get(container.spaceId) : undefined;
      return [item.id, { item, place: [space?.name, container?.name].filter(Boolean).join(" › ") }];
    }),
  );
}

/** Todo lo que necesita la página de compras, reactivo a cualquier cambio de stock, lista o precios. */
export function useShoppingData(): ShoppingData | undefined {
  return useLiveQuery(async () => {
    const [entries, candidates] = await Promise.all([
      db.shoppingList.orderBy("createdAt").toArray(),
      db.shoppingCandidates.where("status").equals("pending").sortBy("createdAt"),
    ]);
    const itemIds = [...new Set([...entries.flatMap((entry) => (entry.inventoryItemId ? [entry.inventoryItemId] : [])), ...candidates.map((candidate) => candidate.itemId)])];
    const [places, records] = await Promise.all([placesOf(itemIds), db.prices.where("itemId").anyOf(itemIds).toArray()]);

    const prices = new Map<string, PriceSummary>();
    for (const itemId of itemIds) {
      const summary = summarizePrices(records.filter((record) => record.itemId === itemId));
      if (summary) prices.set(itemId, summary);
    }

    const toRow = (entry: ShoppingListItem): ShoppingRow => ({
      ...entry,
      linked: entry.inventoryItemId ? places.get(entry.inventoryItemId) : undefined,
      price: entry.inventoryItemId ? prices.get(entry.inventoryItemId) : undefined,
    });
    const cutoff = Date.now() - SHOPPING_LIMITS.boughtVisibleMs;

    return {
      pending: entries.filter((entry) => entry.status === "pending").map(toRow),
      bought: entries
        .filter((entry) => entry.status === "bought" && (entry.boughtAt ?? 0) > cutoff)
        .sort((a, b) => (b.boughtAt ?? 0) - (a.boughtAt ?? 0))
        .map(toRow),
      candidates: candidates.flatMap((candidate): CandidateRow[] => {
        const linked = places.get(candidate.itemId);
        // Más urgente primero: lo agotado antes que lo que está bajo.
        return linked ? [{ ...candidate, linked, suggested: suggestedQuantity(linked.item), price: prices.get(candidate.itemId) }] : [];
      }).sort((a, b) => (a.reason === b.reason ? 0 : a.reason === "empty" ? -1 : 1)),
      prices,
    };
  });
}

/** Contadores para el inicio y el menú. */
export function useShoppingCounts() {
  return useLiveQuery(async () => {
    const [pending, review] = await Promise.all([
      db.shoppingList.where("status").equals("pending").count(),
      db.shoppingCandidates.where("status").equals("pending").count(),
    ]);
    return { pending, review };
  });
}

/** Productos del inventario para autocompletar al anotar algo (y vincularlo). */
export function useInventoryOptions() {
  return useLiveQuery(async () => {
    const items = await db.inventory.orderBy("name").toArray();
    const places = await placesOf(items.map((item) => item.id));
    return items.map((item) => places.get(item.id)!).filter(Boolean);
  });
}

export function useShoppingActions() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const t = useT();

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      if (success) message.success(success);
      return true;
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return false;
    }
  }

  return {
    add: (input: NewShoppingItem) => run(() => addShoppingItem(user, input)),
    confirm: (candidateIds: string[]) =>
      run(() => confirmSuggestions(user, candidateIds), candidateIds.length > 1 ? t("shopping.toast.confirmedAll", { count: candidateIds.length }) : undefined),
    dismiss: (candidateId: string, never = false) => run(() => dismissSuggestion(user, candidateId, never), never ? t("shopping.toast.never") : undefined),
    setQuantity: (id: string, quantity: number) => run(() => setShoppingQuantity(user, id, quantity)),
    buy: (id: string) => run(() => markBought(user, id)),
    unbuy: (id: string) => run(() => unmarkBought(user, id)),
    remove: (id: string) => run(() => removeShoppingItem(user, id)),
    clearBought: () => run(() => clearBought(user), t("shopping.toast.cleared")),
  };
}
