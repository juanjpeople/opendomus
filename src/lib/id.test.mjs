import assert from "node:assert/strict";
import { randomFillSync } from "node:crypto";
import { test } from "node:test";
import { createId } from "./id.ts";

test("uses native randomUUID when available", (t) => {
  const expected = "01234567-89ab-4cde-8fab-0123456789ab";
  t.mock.method(globalThis.crypto, "randomUUID", () => expected);
  assert.equal(createId(), expected);
});

function withoutRandomUUID(getRandomValues, check) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues } });
  try {
    check();
  } finally {
    Object.defineProperty(globalThis, "crypto", original);
  }
}

test("generates unique UUID v4 IDs without randomUUID (HTTP LAN)", () => {
  withoutRandomUUID(randomFillSync, () => {
    const ids = Array.from({ length: 10000 }, createId);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(new Set(ids).size, ids.length);
  });
});

test("sets UUID version and variant bits without weakening randomness", () => {
  withoutRandomUUID((bytes) => bytes.fill(255), () => {
    assert.equal(createId(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
});

test("propagates random source failures instead of using weak IDs", () => {
  withoutRandomUUID(() => { throw new Error("random source unavailable"); }, () => {
    assert.throws(createId, /random source unavailable/);
  });
});
