import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_LIMITS, isUndoable, type ActivityEntry } from "./domain";

const NOW = 1_800_000_000_000;
const entry = (patch: Partial<ActivityEntry>): ActivityEntry => ({
  id: "a",
  at: NOW - 60_000,
  module: "inventory",
  action: "consume",
  actorId: "u",
  actorName: "Ana",
  entityId: "leche",
  entityName: "Leche",
  from: 3,
  to: 2,
  ...patch,
});

test("se deshacen los cambios de cantidad recientes", () => {
  assert.equal(isUndoable(entry({}), NOW), true);
  assert.equal(isUndoable(entry({ action: "adjust" }), NOW), true);
  assert.equal(isUndoable(entry({ action: "restock" }), NOW), true);
});

test("no se deshace lo que no es un cambio de cantidad, ni dos veces, ni lo viejo", () => {
  assert.equal(isUndoable(entry({ action: "create" }), NOW), false);
  assert.equal(isUndoable(entry({ action: "undo" }), NOW), false);
  assert.equal(isUndoable(entry({ module: "prices", action: "price" }), NOW), false);
  assert.equal(isUndoable(entry({ undoneAt: NOW }), NOW), false);
  assert.equal(isUndoable(entry({ from: 2, to: 2 }), NOW), false);
  assert.equal(isUndoable(entry({ at: NOW - ACTIVITY_LIMITS.undoWindowMs - 1 }), NOW), false);
});
