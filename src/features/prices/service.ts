/**
 * Servicio de precios: ÚNICO punto que escribe precios. Cada precio registrado queda
 * también en el historial (con el contenedor del producto, para verlo en su página).
 */
import { recordActivity } from "@/features/activity/service";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { createId } from "@/lib/id";
import { parseNewPrice, type NewPrice } from "./domain";

export async function addPrice(actor: Actor | null, input: NewPrice) {
  assertCan(actor, "prices.manage");
  let id = "";
  await db.transaction("rw", PRICE_TABLES(), async () => {
    id = await addPriceWithin(actor, input);
  });
  return id;
}

/** Tablas que toca registrar un precio. Otros servicios (compras) las suman a su transacción. */
export const PRICE_TABLES = () => [db.inventory, db.containers, db.prices, db.activity];

/** Registra un precio dentro de la transacción de otro servicio (que incluya `PRICE_TABLES`). Verifica el permiso. */
export async function addPriceWithin(actor: Actor, input: NewPrice) {
  assertCan(actor, "prices.manage");
  const data = parseNewPrice(input);
  const id = createId();
  const item = await db.inventory.get(data.itemId);
  if (!item) throw new NotFoundError("errors.notFound.item");
  await db.prices.add({ ...data, id, createdBy: actor.id });
  await recordActivity(actor, {
    module: "prices",
    action: "price",
    entityId: item.id,
    entityName: item.name,
    containerId: item.containerId,
    place: (await db.containers.get(item.containerId))?.name,
    amountCents: data.amountCents,
    currency: data.currency,
    store: data.store,
  });
  return id;
}

export async function deletePrice(actor: Actor | null, id: string) {
  assertCan(actor, "prices.manage");
  await db.prices.delete(id);
}
