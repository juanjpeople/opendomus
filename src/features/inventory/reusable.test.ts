import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "@/lib/db";
import { catalogDefaults, BASIC_CATALOG } from "./catalog";
import { adjustInventoryQuantity, consumeInventoryItem, consumeWithin, createInventoryItem, QUANTITY_TABLES, updateInventoryItem } from "./service";

const admin = { id: "admin", name: "Ana", role: "admin" as const };
after(() => db.close());

test("usar un taladro no lo consume; admite ajustes, persiste la preferencia y no sugiere compras", async () => {
  await db.open();
  const container = (await db.containers.toArray())[0];
  const drill = BASIC_CATALOG.find((entry) => entry.id === "drill")!;
  const id = await createInventoryItem(admin, container.id, catalogDefaults(drill, "es"));
  assert.equal((await db.inventory.get(id))?.reusable, true);
  await assert.rejects(consumeInventoryItem(admin, id), { key: "errors.validation.reusableConsumption" });
  await assert.rejects(db.transaction("rw", QUANTITY_TABLES(), () => consumeWithin(admin, id, 1)));
  assert.equal((await db.inventory.get(id))?.quantity, 1);
  await adjustInventoryQuantity(admin, id, -1);
  assert.equal((await db.inventory.get(id))?.quantity, 0);
  assert.equal(await db.shoppingCandidates.where("itemId").equals(id).count(), 0);
  await updateInventoryItem(admin, id, { reusable: false });
  await adjustInventoryQuantity(admin, id, 2);
  assert.equal((await consumeInventoryItem(admin, id)).quantity, 1);
});
