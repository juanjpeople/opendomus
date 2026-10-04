/**
 * Servicio de inventarios: ÚNICO punto que escribe productos en la base.
 * Toda operación recibe al actor y verifica el permiso acá, no solo en la UI.
 * Cada cambio queda en el historial dentro de la misma transacción.
 * Cuando haya backend, estas funciones pasan a llamar a la API sin tocar los componentes.
 */
import { pruneActivity, recordActivity } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { INVENTORY_LIMITS, parseInventoryPatch, parseNewInventoryItem, type InventoryItemPatch, type NewInventoryItem } from "./domain";

async function containerName(containerId: string) {
  const container = await db.containers.get(containerId);
  if (!container) throw new NotFoundError("errors.notFound.container");
  return container.name;
}

export async function createInventoryItem(actor: Actor | null, containerId: string, input: NewInventoryItem) {
  assertCan(actor, "inventory.create");
  const data = parseNewInventoryItem(input);
  const now = Date.now();
  const id = createId();

  await db.transaction("rw", db.inventory, db.containers, db.activity, async () => {
    const place = await containerName(containerId);
    await db.inventory.add({ ...data, id, containerId, createdAt: now, updatedAt: now });
    await recordActivity(actor, { module: "inventory", action: "create", entityId: id, entityName: data.name, containerId, place, to: data.quantity, unit: data.unit });
  });
  await pruneActivity();
  return id;
}

export async function adjustInventoryQuantity(actor: Actor | null, id: string, delta: number) {
  assertCan(actor, "inventory.adjust");
  // Transacción: lee y escribe atómicamente para no perder clics rápidos.
  await db.transaction("rw", db.inventory, db.containers, db.activity, async () => {
    const item = await db.inventory.get(id);
    if (!item) throw new NotFoundError("errors.notFound.item");
    const quantity = Math.min(Math.max(item.quantity + delta, 0), INVENTORY_LIMITS.maxQuantity);
    if (quantity === item.quantity) return;
    await db.inventory.update(id, { quantity, updatedAt: Date.now() });
    await recordActivity(actor, {
      module: "inventory",
      action: "adjust",
      entityId: id,
      entityName: item.name,
      containerId: item.containerId,
      place: await containerName(item.containerId),
      from: item.quantity,
      to: quantity,
      unit: item.unit,
    });
  });
}

/** Edita un producto. Si cambia `containerId`, queda registrado como "movido". */
export async function updateInventoryItem(actor: Actor | null, id: string, patch: InventoryItemPatch) {
  assertCan(actor, "inventory.create");
  const data = parseInventoryPatch(patch);
  await db.transaction("rw", db.inventory, db.containers, db.activity, async () => {
    const item = await db.inventory.get(id);
    if (!item) throw new NotFoundError("errors.notFound.item");
    const containerId = data.containerId ?? item.containerId;
    const place = await containerName(containerId);
    await db.inventory.update(id, { ...data, updatedAt: Date.now() });
    await recordActivity(actor, {
      module: "inventory",
      action: containerId !== item.containerId ? "move" : "update",
      entityId: id,
      entityName: data.name ?? item.name,
      containerId,
      place,
    });
  });
}

export async function deleteInventoryItem(actor: Actor | null, id: string) {
  assertCan(actor, "inventory.delete");
  await db.transaction("rw", db.inventory, db.containers, db.prices, db.activity, async () => {
    const item = await db.inventory.get(id);
    if (!item) return;
    const place = (await db.containers.get(item.containerId))?.name;
    await db.inventory.delete(id);
    // Sus precios se van con el producto (no tienen sentido solos).
    await db.prices.where("itemId").equals(id).delete();
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
