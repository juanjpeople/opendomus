"use client";

import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import type { InventoryItem } from "@/features/inventory/domain";
import { summarizePrices, type PriceSummary } from "@/features/prices/domain";
import type { Project } from "@/features/projects/domain";
import { useT } from "@/i18n";
import type { Translator } from "@/i18n/translate";
import { useCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import {
  HOME_LIST_ID,
  SHOPPING_LIMITS,
  suggestedQuantity,
  summarizeBudget,
  type ListBudget,
  type NewShoppingItem,
  type ShoppingCandidate,
  type ShoppingList,
  type ShoppingListInput,
  type ShoppingListItem,
} from "./domain";
import {
  addShoppingItem,
  clearBought,
  confirmSuggestions,
  createList,
  deleteList,
  dismissSuggestion,
  markBought,
  moveShoppingItem,
  recordPaid,
  removeShoppingItem,
  setListArchived,
  setShoppingEstimate,
  setShoppingQuantity,
  unmarkBought,
  updateList,
  type PaidInput,
} from "./service";

/** Nombre visible de una lista: la de la casa se traduce, las demás son como las nombraron. */
export function listName(list: Pick<ShoppingList, "id" | "name">, t: Translator) {
  return list.id === HOME_LIST_ID ? t("shopping.lists.home") : list.name;
}

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

export interface ListSummary {
  list: ShoppingList;
  project?: Project;
  budget: ListBudget;
  pending: number;
  bought: number;
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

async function priceSummaries(itemIds: string[]) {
  const records = await db.prices.where("itemId").anyOf(itemIds).toArray();
  const prices = new Map<string, PriceSummary>();
  for (const itemId of itemIds) {
    const summary = summarizePrices(records.filter((record) => record.itemId === itemId));
    if (summary) prices.set(itemId, summary);
  }
  return prices;
}

const linkedIds = (entries: { inventoryItemId?: string }[]) => [...new Set(entries.flatMap((entry) => (entry.inventoryItemId ? [entry.inventoryItemId] : [])))];

/** Todas las listas (activas primero, la de la casa arriba) con su presupuesto. Las usa el selector y los proyectos. */
export async function loadListSummaries(): Promise<ListSummary[]> {
  const [lists, entries, projects] = await Promise.all([db.shoppingLists.toArray(), db.shoppingList.toArray(), db.projects.toArray()]);
  const prices = await priceSummaries(linkedIds(entries));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return lists
    .map((list) => {
      const items = entries.filter((entry) => entry.listId === list.id);
      return {
        list,
        project: list.projectId ? projectById.get(list.projectId) : undefined,
        budget: summarizeBudget(list, items, prices),
        pending: items.filter((entry) => entry.status === "pending").length,
        bought: items.filter((entry) => entry.status === "bought").length,
      };
    })
    .sort((a, b) => Number(!!a.list.archivedAt) - Number(!!b.list.archivedAt) || Number(b.list.id === HOME_LIST_ID) - Number(a.list.id === HOME_LIST_ID) || a.list.createdAt - b.list.createdAt);
}

export function useListSummaries() {
  return useLiveQuery(loadListSummaries);
}

export interface ShoppingData {
  list: ShoppingList;
  budget: ListBudget;
  pending: ShoppingRow[];
  bought: ShoppingRow[];
  /** Solo en la lista de la casa: es adonde llegan las sugerencias. */
  candidates: CandidateRow[];
}

/** Todo lo de una lista, reactivo a cualquier cambio de stock, ítems o precios. `null` si la lista no existe. */
export function useShoppingData(listId: string): ShoppingData | null | undefined {
  return useLiveQuery(async () => {
    const list = await db.shoppingLists.get(listId);
    if (!list) return null;
    const home = list.id === HOME_LIST_ID;
    const [entries, candidates] = await Promise.all([
      db.shoppingList.where("listId").equals(listId).sortBy("createdAt"),
      home ? db.shoppingCandidates.where("status").equals("pending").sortBy("createdAt") : Promise.resolve([] as ShoppingCandidate[]),
    ]);
    const itemIds = [...new Set([...linkedIds(entries), ...candidates.map((candidate) => candidate.itemId)])];
    const [places, prices] = await Promise.all([placesOf(itemIds), priceSummaries(itemIds)]);

    const toRow = (entry: ShoppingListItem): ShoppingRow => ({
      ...entry,
      linked: entry.inventoryItemId ? places.get(entry.inventoryItemId) : undefined,
      price: entry.inventoryItemId ? prices.get(entry.inventoryItemId) : undefined,
    });
    // En la de la casa lo comprado se va solo después de unos días; en las de proyectos queda (es el gasto).
    const cutoff = home ? Date.now() - SHOPPING_LIMITS.boughtVisibleMs : 0;

    return {
      list,
      budget: summarizeBudget(list, entries, prices),
      pending: entries.filter((entry) => entry.status === "pending").map(toRow),
      bought: entries
        .filter((entry) => entry.status === "bought" && (entry.boughtAt ?? 0) > cutoff)
        .sort((a, b) => (b.boughtAt ?? 0) - (a.boughtAt ?? 0))
        .map(toRow),
      candidates: candidates
        .flatMap((candidate): CandidateRow[] => {
          const linked = places.get(candidate.itemId);
          return linked ? [{ ...candidate, linked, suggested: suggestedQuantity(linked.item), price: prices.get(candidate.itemId) }] : [];
        })
        // Más urgente primero: lo agotado antes que lo que está bajo.
        .sort((a, b) => (a.reason === b.reason ? 0 : a.reason === "empty" ? -1 : 1)),
    };
  }, [listId]);
}

/** Contadores para el inicio y el menú: lo pendiente de todas las listas activas y las sugerencias. */
export function useShoppingCounts() {
  return useLiveQuery(async () => {
    const [lists, pending, review] = await Promise.all([
      db.shoppingLists.toArray(),
      db.shoppingList.where("status").equals("pending").toArray(),
      db.shoppingCandidates.where("status").equals("pending").count(),
    ]);
    const active = new Set(lists.filter((list) => !list.archivedAt).map((list) => list.id));
    return { pending: pending.filter((entry) => active.has(entry.listId)).length, review };
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

  async function run<T>(action: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await action();
      if (success) message.success(success);
      return result ?? (true as T);
    } catch (error) {
      message.error(getErrorMessage(error, t));
      return null;
    }
  }

  return {
    add: (input: NewShoppingItem) => run(() => addShoppingItem(user, input)),
    confirm: (candidateIds: string[]) =>
      run(() => confirmSuggestions(user, candidateIds), candidateIds.length > 1 ? t("shopping.toast.confirmedAll", { count: candidateIds.length }) : undefined),
    dismiss: (candidateId: string, never = false) => run(() => dismissSuggestion(user, candidateId, never), never ? t("shopping.toast.never") : undefined),
    setQuantity: (id: string, quantity: number) => run(() => setShoppingQuantity(user, id, quantity)),
    setEstimate: (id: string, amount: number | null) => run(() => setShoppingEstimate(user, id, amount)),
    move: (id: string, listId: string) => run(() => moveShoppingItem(user, id, listId), t("shopping.toast.moved")),
    buy: (id: string) => run(() => markBought(user, id)),
    unbuy: (id: string) => run(() => unmarkBought(user, id)),
    paid: (id: string, input: PaidInput) => run(() => recordPaid(user, id, input)),
    remove: (id: string) => run(() => removeShoppingItem(user, id)),
    clearBought: (listId: string) => run(() => clearBought(user, listId), t("shopping.toast.cleared")),
    createList: (input: ShoppingListInput) => run(() => createList(user, input), t("shopping.lists.toast.created")),
    updateList: (id: string, input: ShoppingListInput) => run(() => updateList(user, id, input), t("shopping.lists.toast.saved")),
    archiveList: (id: string, archived: boolean) => run(() => setListArchived(user, id, archived), archived ? t("shopping.lists.toast.archived") : undefined),
    deleteList: (id: string) => run(() => deleteList(user, id), t("shopping.lists.toast.deleted")),
  };
}
