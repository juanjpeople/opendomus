/**
 * Servicio de inventarios: ÚNICO punto que escribe en la base.
 * Toda operación recibe al actor y verifica el permiso acá, no solo en la UI.
 * Cuando haya backend, estas funciones pasan a llamar a la API sin tocar los componentes.
 */
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { INVENTORY_LIMITS, parseNewInventoryItem, type InventoryType, type NewInventoryItem } from "./domain";

export async function createInventoryItem(actor: Actor | null, type: InventoryType, input: NewInventoryItem) {
  assertCan(actor, "inventory.create");
  const data = parseNewInventoryItem(type, input);
  const now = Date.now();
  return db.inventory.add({ ...data, id: crypto.randomUUID(), inventoryType: type, createdAt: now, updatedAt: now });
}

export async function adjustInventoryQuantity(actor: Actor | null, id: string, delta: number) {
  assertCan(actor, "inventory.adjust");
  // Transacción: lee y escribe atómicamente para no perder clics rápidos.
  await db.transaction("rw", db.inventory, async () => {
    const item = await db.inventory.get(id);
    if (!item) throw new NotFoundError("El ítem ya no existe.");
    const quantity = Math.min(Math.max(item.quantity + delta, 0), INVENTORY_LIMITS.maxQuantity);
    await db.inventory.update(id, { quantity, updatedAt: Date.now() });
  });
}

export async function deleteInventoryItem(actor: Actor | null, id: string) {
  assertCan(actor, "inventory.delete");
  await db.inventory.delete(id);
}
