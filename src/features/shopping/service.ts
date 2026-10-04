/**
 * Servicio de la lista de compras: ÚNICO punto que escribe la lista y las sugerencias.
 * Comprar algo vinculado al inventario lo repone en la misma transacción (vía el servicio
 * de inventario), así la lista y el stock nunca quedan desfasados.
 */
import { pruneActivity, recordActivity } from "@/features/activity/service";
import { QUANTITY_TABLES, restockWithin } from "@/features/inventory/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseNewShoppingItem, parseShoppingQuantity, SHOPPING_LIMITS, suggestedQuantity, type NewShoppingItem } from "./domain";

/** Tablas que toca anotar en la lista. Otros servicios (recetas) las suman a su transacción. */
export const LIST_TABLES = () => [db.shoppingList, db.shoppingCandidates, db.activity, db.inventory];

/**
 * Anota algo en la lista. Si ese producto ya estaba pendiente, suma la cantidad en vez de repetirlo.
 * SOLO para servicios, dentro de una transacción que incluya `LIST_TABLES`. Valida la entrada.
 */
export async function addToListWithin(actor: Actor, raw: NewShoppingItem) {
  const input = parseNewShoppingItem(raw);
  const existing = input.inventoryItemId
    ? await db.shoppingList.where("inventoryItemId").equals(input.inventoryItemId).filter((entry) => entry.status === "pending").first()
    : undefined;

  if (existing) {
    await db.shoppingList.update(existing.id, { quantity: Math.min(existing.quantity + input.quantity, SHOPPING_LIMITS.maxQuantity) });
  } else {
    await db.shoppingList.add({ ...input, id: createId(), status: "pending", createdBy: actor.id, createdAt: Date.now() });
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

/** Pasa sugerencias de "Para revisar" a la lista, con la cantidad que falta para llegar al mínimo. */
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
    await db.shoppingList.update(id, { status: "pending", boughtAt: undefined, boughtBy: undefined, restocked: undefined });
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

/** Saca de la lista todo lo ya comprado (el stock y el historial quedan como están). */
export async function clearBought(actor: Actor | null) {
  assertCan(actor, "shopping.manage");
  await db.shoppingList.where("status").equals("bought").delete();
}
