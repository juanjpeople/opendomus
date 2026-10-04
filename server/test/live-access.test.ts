import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizedLiveSessions, liveIdentity } from "../src/live-access";

test("los sockets antiguos o sin identidad se rechazan sin asumir una sesión", () => {
  for (const value of [null, undefined, {}, { householdId: "h", userId: "u", sessionId: "" }, { householdId: 1, userId: "u", sessionId: "s" }]) {
    assert.equal(liveIdentity(value), null);
  }
  assert.deepEqual(liveIdentity({ householdId: "h", userId: "u", sessionId: "s" }), { householdId: "h", userId: "u", sessionId: "s" });
});

test("una tanda no mezcla casas y una falla de D1 nunca concede acceso", async () => {
  let calls = 0;
  const db = { prepare: () => { calls++; throw new Error("D1 unavailable"); } } as unknown as Parameters<typeof authorizedLiveSessions>[0];
  assert.deepEqual(await authorizedLiveSessions(db, []), new Set());
  await assert.rejects(authorizedLiveSessions(db, [
    { householdId: "a", userId: "u", sessionId: "s" },
    { householdId: "b", userId: "u", sessionId: "s" },
  ]), /invalid-live-batch/);
  assert.equal(calls, 0);
  await assert.rejects(authorizedLiveSessions(db, [{ householdId: "a", userId: "u", sessionId: "s" }]), /D1 unavailable/);
});
