import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { db } from "@/lib/db";
import { setSyncLink } from "./middleware";
import { flushPendingPhotoDeletes, queuePhotoDeletes } from "./photos";

const householdId = "11111111-1111-4111-8111-111111111111";
const photoId = "22222222-2222-4222-8222-222222222222";
const originalFetch = globalThis.fetch;

before(async () => {
  await db.delete();
  await db.open();
  setSyncLink({ householdId, userId: "ana", deviceId: "telefono" });
});

after(async () => {
  globalThis.fetch = originalFetch;
  setSyncLink(null);
  db.close();
});

test("un borrado remoto se conserva hasta que el servidor lo confirma", async () => {
  await queuePhotoDeletes([photoId]);
  assert.equal(await db.photoDeletes.count(), 1);

  globalThis.fetch = async () => new Response(JSON.stringify({ error: "server" }), { status: 503, headers: { "Content-Type": "application/json" } });
  await assert.rejects(flushPendingPhotoDeletes(householdId));
  assert.equal(await db.photoDeletes.count(), 1);

  let request: { method?: string; url?: string } = {};
  globalThis.fetch = async (input, init) => {
    request = { method: init?.method, url: String(input) };
    return Response.json({ ok: true });
  };
  await flushPendingPhotoDeletes(householdId);

  assert.deepEqual(request, {
    method: "DELETE",
    url: `/api/households/${householdId}/photos/${photoId}`,
  });
  assert.equal(await db.photoDeletes.count(), 0);
});
