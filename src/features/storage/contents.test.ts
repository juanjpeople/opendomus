import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Dexie from "dexie";
import { addPhotos, deletePhoto } from "@/features/media/service";
import { exportAllData, importAllData, parseExport } from "@/features/settings/service";
import { db, declareSchema } from "@/lib/db";
import { setSyncLink } from "@/lib/sync/middleware";
import { CONTENT_LIMITS, parseContentText } from "./domain";
import { createContainer, deleteContainer, deleteContainerContent, saveContainerContent } from "./service";

const admin = { id: "admin", name: "Ana", role: "admin" as const };
const kid = { id: "kid", name: "Tomi", role: "kid" as const };
let containerId: string;

before(async () => {
  await db.open();
  const space = (await db.spaces.toArray())[0];
  containerId = await createContainer(admin, { name: "Caja de recuerdos", kind: "box", spaceId: space.id });
});
after(() => { setSyncLink(null); db.close(); });

test("el contenido libre valida límites y permisos, sin crear stock ni sugerencias", async () => {
  assert.equal(parseContentText("  Cables sueltos  "), "Cables sueltos");
  assert.throws(() => parseContentText(" "));
  assert.throws(() => parseContentText("a".repeat(CONTENT_LIMITS.textMaxLength + 1)));
  await assert.rejects(saveContainerContent(kid, containerId, "Cables"));
  await assert.rejects(saveContainerContent(admin, "ausente", "Cables"));
  const id = await saveContainerContent(admin, containerId, "  Cables  ");
  assert.equal((await db.containerContents.get(id))?.text, "Cables");
  await saveContainerContent(admin, containerId, "Cables USB viejos", id);
  const other = (await db.containers.toArray()).find((container) => container.id !== containerId)!;
  await assert.rejects(saveContainerContent(admin, other.id, "No se mueve desde una ficha ajena", id));
  assert.equal((await db.containerContents.get(id))?.text, "Cables USB viejos");
  assert.equal(await db.inventory.count(), 0);
  assert.equal(await db.shoppingCandidates.count(), 0);
  await assert.rejects(deleteContainer(admin, containerId));
  await assert.rejects(deleteContainerContent(kid, id));
  await deleteContainerContent(admin, id);
});

test("dos altas simultáneas respetan el límite dentro de la transacción", async () => {
  const rows = Array.from({ length: CONTENT_LIMITS.maxPerContainer - 1 }, (_, index) => ({
    id: `limit-${index}`, containerId, text: `Objeto ${index}`, createdBy: admin.id, createdAt: index, updatedAt: index,
  }));
  await db.containerContents.bulkAdd(rows);
  const results = await Promise.allSettled([saveContainerContent(admin, containerId, "Uno"), saveContainerContent(admin, containerId, "Otro")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await db.containerContents.where("containerId").equals(containerId).count(), CONTENT_LIMITS.maxPerContainer);
  await db.containerContents.where("containerId").equals(containerId).delete();
});

test("anotaciones y fotos se exportan y recuperan con el mismo QR; no se borran por accidente", async () => {
  const code = (await db.containers.get(containerId))!.code;
  const id = await saveContainerContent(admin, containerId, "Piezas por identificar");
  await db.photos.add({ id: "photo", ownerType: "container", ownerId: containerId, blob: new Blob(["imagen"]), width: 20, height: 20, createdAt: 1, createdBy: admin.id });
  const exported = await exportAllData(admin);
  assert.equal(exported.schemaVersion, 12);
  await importAllData(admin, parseExport(JSON.parse(JSON.stringify(exported))));
  assert.equal((await db.containers.get(containerId))?.code, code);
  assert.equal((await db.containerContents.get(id))?.text, "Piezas por identificar");
  assert.equal(await (await db.photos.get("photo"))?.blob?.text(), "imagen");
  await deleteContainerContent(admin, id);
  await assert.rejects(deleteContainer(admin, containerId));
  await assert.rejects(deletePhoto(kid, "photo"));
  await deletePhoto(admin, "photo");
  await assert.rejects(addPhotos(admin, "container", "ausente", []));
});

test("cada anotación registra su cambio para sincronizar; borrar fotos conserva la cola remota", async () => {
  setSyncLink({ householdId: "house", userId: "ana", deviceId: "desktop" });
  const id = await saveContainerContent(admin, containerId, "Recuerdos");
  assert.equal((await db.syncRecords.get(`containerContents|${id}`))?.pending, 1);
  await db.photos.add({ id: "remote-photo", ownerType: "container", ownerId: containerId, width: 20, height: 20, createdAt: 1, createdBy: admin.id });
  await deletePhoto(admin, "remote-photo");
  assert.equal((await db.photoDeletes.toArray())[0]?.photoId, "remote-photo");
  setSyncLink(null);
});

test("la migración desde v11 conserva contenedores, códigos y fotos existentes", async () => {
  const name = "StorageUpgradeTest";
  const old = new Dexie(name);
  declareSchema(old, 11);
  await old.open();
  await old.table("containers").put({ id: "box", code: "K7QM", name: "Caja" });
  await old.table("photos").put({ id: "recipe-photo", ownerType: "recipe", ownerId: "recipe" });
  await old.table("syncState").put({ key: "cursor", value: 42 });
  await old.table("syncState").put({ key: "inflight", value: { id: "pending" } });
  old.close();
  const current = new Dexie(name);
  try {
    declareSchema(current);
    await current.open();
    assert.equal((await current.table("containers").get("box")).code, "K7QM");
    assert.equal((await current.table("photos").get("recipe-photo")).ownerType, "recipe");
    assert.equal(await current.table("containerContents").count(), 0);
    assert.equal(await current.table("syncState").get("cursor"), undefined);
    assert.equal((await current.table("syncState").get("containerContentsBackfillUntil")).value, 42);
    assert.deepEqual((await current.table("syncState").get("inflight")).value, { id: "pending" });
  } finally { current.close(); await Dexie.delete(name); }
});
