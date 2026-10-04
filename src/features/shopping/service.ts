/**
 * Servicio de compras: ÚNICO punto que escribe las listas, sus ítems y las sugerencias.
 * Comprar algo vinculado al inventario lo repone en la misma transacción (vía el servicio
 * de inventario), así la lista y el stock nunca quedan desfasados.
 */
import { pruneActivity, recordActivity } from "@/features/activity/service";
import { QUANTITY_TABLES, restockWithin } from "@/features/inventory/service";
import { CURRENCIES, type Currency } from "@/features/prices/domain";
import { addPriceWithin, PRICE_TABLES } from "@/features/prices/service";
import { assertCan, can, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import {
  HOME_LIST_ID,
  parseListInput,
  parseMoney,
  parseNewShoppingItem,
  parseShoppingQuantity,
  SHOPPING_LIMITS,
  suggestedQuantity,
  type NewShoppingItem,
  type ShoppingListInput,
} from "./domain";

/** Tablas que toca anotar en una lista. Otros servicios (recetas) las suman a su transacción. */
export const LIST_TABLES = () => [db.shoppingList, db.shoppingLists, db.shoppingCandidates, db.activity, db.inventory];

async function getActiveList(id: string) {
  const list = await db.shoppingLists.get(id);
  if (!list || list.archivedAt) throw new NotFoundError("errors.notFound.list");
  return list;
}

/**
 * Anota algo en una lista (sin lista: la de la casa). Si ese producto ya estaba pendiente en esa
 * lista, suma la cantidad en vez de repetirlo. SOLO para servicios, dentro de una transacción que
 * incluya `LIST_TABLES`. Valida la entrada.
 */
export async function addToListWithin(actor: Actor, raw: NewShoppingItem) {
  const { estimate, ...input } = parseNewShoppingItem(raw);
  const listId = input.listId ?? HOME_LIST_ID;
  await getActiveList(listId);
  const existing = input.inventoryItemId
    ? await db.shoppingList
        .where("[listId+status]")
        .equals([listId, "pending"])
        .filter((entry) => entry.inventoryItemId === input.inventoryItemId)
        .first()
    : undefined;

  if (existing) {
    await db.shoppingList.update(existing.id, { quantity: Math.min(existing.quantity + input.quantity, SHOPPING_LIMITS.maxQuantity) });
  } else {
    await db.shoppingList.add({ ...input, listId, estimateCents: parseMoney(estimate), id: createId(), status: "pending", createdBy: actor.id, createdAt: Date.now() });
    await recordActivity(actor, { module: "shopping", action: "create", entityId: input.inventoryItemId ?? input.name, entityName: input.name });
  }

  // Si estaba esperando revisión, anotarlo a mano es confirmarlo.
  if (input.inventoryItemId) {
    await db.shoppingCandidates
      .where("itemId")
      .equals(input.inventoryItemId)
      .filter((candidate) => candidate.status === "pending")
      .modify({ status: "confirmed", resolvedAt: Date.now(), resolvedBy: actor.id });
  }
}

export async function addShoppingItem(actor: Actor | null, input: NewShoppingItem) {
  assertCan(actor, "shopping.manage");
  const data = parseNewShoppingItem(input);
  await db.transaction("rw", LIST_TABLES(), async () => {
    if (data.inventoryItemId && !(await db.inventory.get(data.inventoryItemId))) throw new NotFoundError("errors.notFound.item");
    await addToListWithin(actor, data);
  });
  await pruneActivity();
}

/** Pasa sugerencias de "Para revisar" a la lista de la casa, con la cantidad que falta para llegar al mínimo. */
export async function confirmSuggestions(actor: Actor | null, candidateIds: string[]) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", LIST_TABLES(), async () => {
    for (const candidate of await db.shoppingCandidates.bulkGet(candidateIds)) {
      if (!candidate || candidate.status !== "pending") continue;
      const item = await db.inventory.get(candidate.itemId);
      if (!item) {
        await db.shoppingCandidates.delete(candidate.id);
        continue;
      }
      await addToListWithin(actor, { name: item.name, quantity: suggestedQuantity(item), unit: item.unit, inventoryItemId: item.id });
    }
  });
  await pruneActivity();
}

/** Descarta una sugerencia. Con `never`, ese producto deja de sugerirse (se reactiva desde su detalle). */
export async function dismissSuggestion(actor: Actor | null, candidateId: string, never = false) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", LIST_TABLES(), async () => {
    const candidate = await db.shoppingCandidates.get(candidateId);
    if (!candidate || candidate.status !== "pending") return;
    await db.shoppingCandidates.update(candidateId, { status: "dismissed", resolvedAt: Date.now(), resolvedBy: actor.id });
    const item = await db.inventory.get(candidate.itemId);
    if (!item) return;
    // Preferencia del producto, no su stock: no pasa por el servicio de inventario.
    if (never) await db.inventory.update(item.id, { autoSuggest: false, updatedAt: Date.now() });
    await recordActivity(actor, { module: "shopping", action: "dismiss", entityId: item.id, entityName: item.name, containerId: item.containerId });
  });
}

export async function setShoppingQuantity(actor: Actor | null, id: string, quantity: number) {
  assertCan(actor, "shopping.manage");
  await db.shoppingList.update(id, { quantity: parseShoppingQuantity(quantity) });
}

/** Precio estimado por unidad (para lo que no tiene historial de precios). `null` lo borra. */
export async function setShoppingEstimate(actor: Actor | null, id: string, amount: number | null) {
  assertCan(actor, "shopping.manage");
  await db.shoppingList.update(id, { estimateCents: parseMoney(amount) });
}

/** Pasa un ítem a otra lista (ej. de "Casa" a "Renovación baño"). */
export async function moveShoppingItem(actor: Actor | null, id: string, listId: string) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", db.shoppingList, db.shoppingLists, async () => {
    await getActiveList(listId);
    await db.shoppingList.update(id, { listId });
  });
}

/**
 * Marca como comprado. Si repone un producto, la cantidad entra al inventario en el acto
 * (queda anotado cuánto, para poder desmarcarlo sin dejar stock de más).
 */
export async function markBought(actor: Actor | null, id: string) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", [db.shoppingList, ...QUANTITY_TABLES()], async () => {
    const entry = await db.shoppingList.get(id);
    if (!entry || entry.status === "bought") return;
    const restocked = entry.inventoryItemId ? await restockWithin(actor, entry.inventoryItemId, entry.quantity) : 0;
    await db.shoppingList.update(id, { status: "bought", boughtAt: Date.now(), boughtBy: actor.id, restocked });
    // Lo que repone el inventario ya queda en su historial ("repuso"); lo suelto se registra acá.
    if (!entry.inventoryItemId) {
      await recordActivity(actor, { module: "shopping", action: "bought", entityId: entry.id, entityName: entry.name, to: entry.quantity, unit: entry.unit });
    }
  });
  await pruneActivity();
}

/** Desmarca algo comprado por error: vuelve a pendiente y saca del inventario lo que había sumado. */
export async function unmarkBought(actor: Actor | null, id: string) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", [db.shoppingList, ...QUANTITY_TABLES()], async () => {
    const entry = await db.shoppingList.get(id);
    if (!entry || entry.status !== "bought") return;
    if (entry.inventoryItemId && entry.restocked) await restockWithin(actor, entry.inventoryItemId, -entry.restocked);
    await db.shoppingList.update(id, { status: "pending", boughtAt: undefined, boughtBy: undefined, restocked: undefined, paidCents: undefined, paidCurrency: undefined });
  });
}

export interface PaidInput {
  /** Precio por unidad, en unidades de la moneda. */
  unitAmount: number;
  currency: Currency;
  store: string;
}

/**
 * "¿Cuánto salió?": anota lo pagado en el ítem (cuenta para el presupuesto de la lista) y, si está
 * vinculado y la persona puede, también en el historial de precios del producto.
 */
export async function recordPaid(actor: Actor | null, id: string, input: PaidInput) {
  assertCan(actor, "shopping.manage");
  if (!CURRENCIES.includes(input.currency)) throw new ValidationError("errors.validation.currencyInvalid");
  const unitCents = parseMoney(input.unitAmount);
  if (!unitCents) throw new ValidationError("errors.validation.amountInvalid");
  await db.transaction("rw", [db.shoppingList, ...PRICE_TABLES()], async () => {
    const entry = await db.shoppingList.get(id);
    if (!entry) throw new NotFoundError("errors.notFound.item");
    await db.shoppingList.update(id, { paidCents: unitCents * entry.quantity, paidCurrency: input.currency, store: input.store.trim() || undefined });
    if (entry.inventoryItemId && can(actor, "prices.manage") && (await db.inventory.get(entry.inventoryItemId))) {
      await addPriceWithin(actor, { itemId: entry.inventoryItemId, amount: unitCents / 100, currency: input.currency, store: input.store, at: Date.now() });
    }
  });
}

export async function removeShoppingItem(actor: Actor | null, id: string) {
  assertCan(actor, "shopping.manage");
  await db.transaction("rw", LIST_TABLES(), async () => {
    const entry = await db.shoppingList.get(id);
    if (!entry) return;
    await db.shoppingList.delete(id);
    if (entry.status === "pending") {
      await recordActivity(actor, { module: "shopping", action: "delete", entityId: entry.inventoryItemId ?? entry.id, entityName: entry.name });
    }
  });
}

/** Saca de una lista lo ya comprado (el stock y el historial quedan como están). */
export async function clearBought(actor: Actor | null, listId: string) {
  assertCan(actor, "shopping.manage");
  await db.shoppingList.where("[listId+status]").equals([listId, "bought"]).delete();
}

// --- Listas -----------------------------------------------------------------------

export async function createList(actor: Actor | null, input: ShoppingListInput) {
  assertCan(actor, "shopping.manage");
  const data = parseListInput(input);
  const id = createId();
  const now = Date.now();
  await db.transaction("rw", db.shoppingLists, db.projects, db.activity, async () => {
    if (data.projectId && !(await db.projects.get(data.projectId))) throw new NotFoundError("errors.notFound.project");
    await db.shoppingLists.add({ ...data, id, createdBy: actor.id, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "lists", action: "create", entityId: id, entityName: data.name });
  });
  return id;
}

export async function updateList(actor: Actor | null, id: string, input: ShoppingListInput) {
  assertCan(actor, "shopping.manage");
  const data = parseListInput(input);
  await db.transaction("rw", db.shoppingLists, db.projects, db.activity, async () => {
    if (!(await db.shoppingLists.get(id))) throw new NotFoundError("errors.notFound.list");
    if (data.projectId && !(await db.projects.get(data.projectId))) throw new NotFoundError("errors.notFound.project");
    // La lista de la casa no se mueve a un proyecto: es la de todos los días.
    await db.shoppingLists.update(id, { ...data, projectId: id === HOME_LIST_ID ? undefined : data.projectId, updatedAt: Date.now() });
    await recordActivity(actor, { module: "lists", action: "update", entityId: id, entityName: data.name });
  });
}

/** Archiva (o desarchiva) una lista: deja de verse entre las activas, pero su gasto queda. */
export async function setListArchived(actor: Actor | null, id: string, archived: boolean) {
  assertCan(actor, "shopping.manage");
  if (id === HOME_LIST_ID) throw new ValidationError("errors.shopping.homeList");
  await db.shoppingLists.update(id, { archivedAt: archived ? Date.now() : undefined, updatedAt: Date.now() });
}

/** Borra una lista con todos sus ítems. La de la casa no se puede borrar. */
export async function deleteList(actor: Actor | null, id: string) {
  assertCan(actor, "shopping.manage");
  if (id === HOME_LIST_ID) throw new ValidationError("errors.shopping.homeList");
  await db.transaction("rw", db.shoppingLists, db.shoppingList, db.activity, async () => {
    const list = await db.shoppingLists.get(id);
    if (!list) return;
    await db.shoppingList.where("listId").equals(id).delete();
    await db.shoppingLists.delete(id);
    await recordActivity(actor, { module: "lists", action: "delete", entityId: id, entityName: list.name });
  });
}
