/**
 * Servicio de inventarios: ÚNICO punto que escribe productos en la base.
 * Toda operación recibe al actor y verifica el permiso acá, no solo en la UI.
 * Cada cambio queda en el historial dentro de la misma transacción, y si el stock cruza el
 * mínimo, la sugerencia de la lista de compras se actualiza en esa misma transacción.
 * Cuando haya backend, estas funciones pasan a llamar a la API sin tocar los componentes.
 */
import { isUndoable, type ActivityAction } from "@/features/activity/domain";
import { pruneActivity, recordActivity } from "@/features/activity/service";
import { dropSuggestions, SUGGESTION_TABLES, syncSuggestion } from "@/features/shopping/suggestions";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createId } from "@/lib/id";
import {
  getStockStatus,
  INVENTORY_LIMITS,
  parseInventoryPatch,
  parseNewInventoryItem,
  planConsumption,
  type ConsumptionPlan,
  type InventoryItem,
  type InventoryItemPatch,
  type NewInventoryItem,
} from "./domain";

/** Tablas que toca cualquier cambio de cantidad (producto, lugar, historial y sugerencias). Otros servicios las suman a su transacción. */
export const QUANTITY_TABLES = () => [db.inventory, db.containers, db.activity, ...SUGGESTION_TABLES()];

async function containerName(containerId: string) {
  const container = await db.containers.get(containerId);
  if (!container) throw new NotFoundError("errors.notFound.container");
  return container.name;
}

async function getItem(id: string) {
  const item = await db.inventory.get(id);
  if (!item) throw new NotFoundError("errors.notFound.item");
  return item;
}

/**
 * Cambia la cantidad de un producto, lo registra y revisa su sugerencia de compra.
 * SOLO para servicios, dentro de una transacción que incluya `QUANTITY_TABLES`.
 */
async function writeQuantity(actor: Actor, item: InventoryItem, quantity: number, action: Extract<ActivityAction, "adjust" | "consume" | "restock" | "undo">) {
  const next = Math.min(Math.max(quantity, 0), INVENTORY_LIMITS.maxQuantity);
  if (next === item.quantity) return { item, entryId: null };
  const updated = { ...item, quantity: next, updatedAt: Date.now() };
  await db.inventory.put(updated);
  const entryId = await recordActivity(actor, {
    module: "inventory",
    action,
    entityId: item.id,
    entityName: item.name,
    containerId: item.containerId,
    place: await containerName(item.containerId),
    from: item.quantity,
    to: next,
    unit: item.unit,
  });
  await syncSuggestion(getStockStatus(item), updated);
  return { item: updated, entryId };
}

export async function createInventoryItem(actor: Actor | null, containerId: string, input: NewInventoryItem) {
  assertCan(actor, "inventory.create");
  const data = parseNewInventoryItem(input);
  const now = Date.now();
  const id = createId();

  await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const place = await containerName(containerId);
    const item: InventoryItem = { ...data, id, containerId, createdAt: now, updatedAt: now };
    await db.inventory.add(item);
    await recordActivity(actor, { module: "inventory", action: "create", entityId: id, entityName: data.name, containerId, place, to: data.quantity, unit: data.unit });
    // Un producto que se carga ya agotado (o por debajo del mínimo) también va a "Para revisar".
    await syncSuggestion(null, item);
  });
  await pruneActivity();
  return id;
}

export async function adjustInventoryQuantity(actor: Actor | null, id: string, delta: number) {
  assertCan(actor, "inventory.adjust");
  // Transacción: lee y escribe atómicamente para no perder clics rápidos.
  await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const item = await getItem(id);
    await writeQuantity(actor, item, item.quantity + delta, "adjust");
  });
}

/**
 * "Usé / consumí": distinto de corregir la cantidad, queda como consumo (alimenta estadísticas).
 * Nunca deja negativos: si no alcanza, descuenta hasta 0 y devuelve cuánto faltó.
 */
export async function consumeInventoryItem(actor: Actor | null, id: string, amount = 1): Promise<ConsumptionPlan & { entryId: string | null }> {
  assertCan(actor, "inventory.consume");
  const plan = await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const item = await getItem(id);
    const result = planConsumption(item.quantity, amount);
    const { entryId } = result.consumed > 0 ? await writeQuantity(actor, item, result.quantity, "consume") : { entryId: null };
    return { ...result, entryId };
  });
  await pruneActivity();
  return plan;
}

/**
 * Consumo dentro de la transacción de otro servicio (ej. "Cociné esto"), que debe incluir
 * `QUANTITY_TABLES`. Mismas reglas que `consumeInventoryItem`; si el producto ya no existe, no hace nada.
 */
export async function consumeWithin(actor: Actor, id: string, amount: number): Promise<ConsumptionPlan | null> {
  const item = await db.inventory.get(id);
  if (!item) return null;
  const plan = planConsumption(item.quantity, amount);
  if (plan.consumed > 0) await writeQuantity(actor, item, plan.quantity, "consume");
  return plan;
}

/**
 * Suma lo comprado al inventario. SOLO para otros servicios (la lista de compras), dentro de
 * su transacción, que debe incluir `QUANTITY_TABLES`. Devuelve cuánto se sumó de verdad.
 */
export async function restockWithin(actor: Actor, id: string, amount: number) {
  const item = await db.inventory.get(id);
  if (!item) return 0;
  const { item: updated } = await writeQuantity(actor, item, item.quantity + amount, amount >= 0 ? "restock" : "undo");
  return updated.quantity - item.quantity;
}

/**
 * Deshace un cambio de cantidad del historial. Revierte la DIFERENCIA sobre la cantidad actual
 * (no vuelve al número viejo), así no pisa lo que otros hicieron después.
 */
export async function undoQuantityChange(actor: Actor | null, entryId: string) {
  assertCan(actor, "inventory.adjust");
  await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const entry = await db.activity.get(entryId);
    if (!entry || !isUndoable(entry, Date.now())) throw new ValidationError("errors.activity.notUndoable");
    const item = await getItem(entry.entityId);
    await writeQuantity(actor, item, item.quantity + (entry.from! - entry.to!), "undo");
    await db.activity.update(entryId, { undoneAt: Date.now(), undoneBy: actor.name });
  });
}

/** Edita un producto. Si cambia `containerId`, queda registrado como "movido". */
export async function updateInventoryItem(actor: Actor | null, id: string, patch: InventoryItemPatch) {
  assertCan(actor, "inventory.create");
  const data = parseInventoryPatch(patch);
  await db.transaction("rw", QUANTITY_TABLES(), async () => {
    const item = await getItem(id);
    const containerId = data.containerId ?? item.containerId;
    const place = await containerName(containerId);
    const updated: InventoryItem = { ...item, ...data, updatedAt: Date.now() };
    await db.inventory.put(updated);
    await recordActivity(actor, {
      module: "inventory",
      action: containerId !== item.containerId ? "move" : "update",
      entityId: id,
      entityName: data.name ?? item.name,
      containerId,
      place,
    });
    // Cambiar el mínimo puede hacer que algo pase a "stock bajo" (o deje de estarlo).
    await syncSuggestion(getStockStatus(item), updated);
  });
}

export async function deleteInventoryItem(actor: Actor | null, id: string) {
  assertCan(actor, "inventory.delete");
  await db.transaction("rw", [db.prices, ...QUANTITY_TABLES()], async () => {
    const item = await db.inventory.get(id);
    if (!item) return;
    const place = (await db.containers.get(item.containerId))?.name;
    await db.inventory.delete(id);
    // Sus precios y sugerencias se van con el producto (no tienen sentido solos). Si estaba
    // anotado en la lista, queda como ítem suelto: alguien lo quería comprar.
    await db.prices.where("itemId").equals(id).delete();
    await dropSuggestions(id);
    await db.shoppingList.where("inventoryItemId").equals(id).modify((entry) => {
      delete entry.inventoryItemId;
    });
    await recordActivity(actor, {
      module: "inventory",
      action: "delete",
      entityId: id,
      entityName: item.name,
      containerId: item.containerId,
      place,
      from: item.quantity,
      unit: item.unit,
    });
  });
}
