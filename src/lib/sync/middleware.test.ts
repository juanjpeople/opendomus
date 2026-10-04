/**
 * El registro de cambios dentro de transacciones reales de IndexedDB (en memoria), usando los
 * servicios de verdad: lo que hace la app queda anotado para subir, en la misma transacción.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { consumeInventoryItem, createInventoryItem, deleteInventoryItem, updateInventoryItem } from "@/features/inventory/service";
import { db } from "@/lib/db";
import { recordKey } from "./merge";
import { getSyncLink, onLocalChange, setSyncLink, untracked } from "./middleware";

const admin = { id: "profile-admin", name: "Ana", role: "admin" as const };
const meta = (table: string, id: string) => db.syncRecords.get(recordKey(table as never, id));

describe("registro de cambios locales", () => {
  let containerId = "";

  before(async () => {
    await db.open();
    containerId = (await db.containers.toCollection().first())!.id;
  });

  test("en una casa solo local no se anota nada", async () => {
    assert.equal(getSyncLink(), null);
    await createInventoryItem(admin, containerId, { name: "Arroz", quantity: 2, unit: "kg", minThreshold: 0 });
    assert.equal(await db.syncRecords.count(), 0);
  });

  test("con la casa en la nube, crear, consumir, editar y borrar quedan anotados", async () => {
    setSyncLink({ householdId: "h", userId: "ana", deviceId: "d1" });
    let notified = 0;
    const stop = onLocalChange(() => notified++);

    await createInventoryItem(admin, containerId, { name: "Leche", quantity: 3, unit: "litros", minThreshold: 2 });
    const milk = (await db.inventory.where("name").equals("Leche").first())!;
    const created = (await meta("inventory", milk.id))!;
    assert.equal(created.full, true);
    assert.equal(created.pending, 1);
    // El historial del alta también viaja (en la misma transacción).
    const entry = (await db.activity.orderBy("at").last())!;
    assert.equal((await meta("activity", entry.id))?.full, true);
    assert.ok(notified >= 1);

    // Simulamos que ya se subió: lo que sigue son cambios sobre algo publicado.
    await db.syncRecords.put({ ...created, full: false, pending: 0, scope: "family", base: 1 });
    await consumeInventoryItem(admin, milk.id, 1);
    await consumeInventoryItem(admin, milk.id, 1);
    const consumed = (await meta("inventory", milk.id))!;
    assert.deepEqual(consumed.deltas, { quantity: -2 });
    assert.ok("updatedAt" in consumed.dirty);
    // Quedó por debajo del mínimo: la sugerencia de compra también se anotó.
    const candidate = (await db.shoppingCandidates.where("itemId").equals(milk.id).first())!;
    assert.equal((await meta("shoppingCandidates", candidate.id))?.full, true);

    await updateInventoryItem(admin, milk.id, { name: "Leche entera" });
    assert.ok("name" in (await meta("inventory", milk.id))!.dirty);

    await deleteInventoryItem(admin, milk.id);
    const deleted = (await meta("inventory", milk.id))!;
    assert.equal(deleted.deleted, true);
    assert.deepEqual(deleted.dirty, {});
    stop();
  });

  test("algo creado y borrado antes de subirse se olvida", async () => {
    await createInventoryItem(admin, containerId, { name: "Pan", quantity: 1, unit: "unidades", minThreshold: 0 });
    const bread = (await db.inventory.where("name").equals("Pan").first())!;
    assert.ok(await meta("inventory", bread.id));
    await deleteInventoryItem(admin, bread.id);
    assert.equal(await meta("inventory", bread.id), undefined);
  });

  test("lo que llega de otros dispositivos (transacción sin registro) no se vuelve a anotar", async () => {
    await db.transaction("rw", db.inventory, async (tx) => {
      untracked(tx);
      await db.inventory.put({ id: "remoto", name: "Yerba", quantity: 1, unit: "unidades", minThreshold: 0, containerId, createdAt: 1, updatedAt: 1 });
    });
    assert.equal(await meta("inventory", "remoto"), undefined);
  });

  test("borrar por rango (vaciar una tabla) también se anota, cosa por cosa", async () => {
    await db.syncRecords.put({ ...(await import("./merge")).emptyRecord("inventory", "remoto"), scope: "family", base: 3 });
    await db.inventory.where("id").equals("remoto").delete();
    assert.equal((await meta("inventory", "remoto"))?.deleted, true);
  });

  test("el PIN de un perfil no se anota como cambio", async () => {
    const member = (await db.members.get("profile-admin"))!;
    await db.syncRecords.put({ ...(await import("./merge")).emptyRecord("members", member.id), scope: "family", base: 1 });
    await db.members.put({ ...member, pin: { hash: "h", salt: "s", iterations: 1 } });
    assert.equal((await meta("members", member.id))!.pending, 0);
    setSyncLink(null);
  });
});
