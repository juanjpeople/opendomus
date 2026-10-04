/**
 * Sugerencias automáticas para la lista de compras. SOLO para servicios: se llama dentro de
 * la transacción que cambió el stock (que debe incluir `db.shoppingCandidates` y `db.shoppingList`),
 * así el producto y su sugerencia nunca quedan desfasados.
 */
import type { InventoryItem, StockStatus } from "@/features/inventory/domain";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { decideSuggestion } from "./domain";

/** Tablas que tiene que incluir la transacción de quien llama a `syncSuggestion`. */
export const SUGGESTION_TABLES = () => [db.shoppingCandidates, db.shoppingList];

/** Revisa la sugerencia de un producto después de un cambio. `previous` = estado antes (`null` si es nuevo). */
export async function syncSuggestion(previous: StockStatus | null, item: InventoryItem) {
  const [pending, onList] = await Promise.all([
    db.shoppingCandidates.where("itemId").equals(item.id).filter((candidate) => candidate.status === "pending").first(),
    db.shoppingList.where("inventoryItemId").equals(item.id).filter((entry) => entry.status === "pending").count(),
  ]);

  const change = decideSuggestion({ previous, item, pendingReason: pending?.reason ?? null, onList: onList > 0 });
  switch (change.type) {
    case "create":
      await db.shoppingCandidates.add({ id: createId(), itemId: item.id, reason: change.reason, status: "pending", createdAt: Date.now() });
      break;
    case "update":
      if (pending) await db.shoppingCandidates.update(pending.id, { reason: change.reason });
      break;
    case "withdraw":
      // Nadie la revisó y ya no hace falta: se borra (no es una decisión de nadie que valga guardar).
      if (pending) await db.shoppingCandidates.delete(pending.id);
      break;
  }
}

/** Al borrar un producto, sus sugerencias pendientes no tienen sentido. */
export async function dropSuggestions(itemId: string) {
  await db.shoppingCandidates.where("itemId").equals(itemId).delete();
}
