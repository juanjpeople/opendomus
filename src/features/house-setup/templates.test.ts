import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "@/lib/db";
import { BASIC_CATALOG } from "@/features/inventory/catalog";
import { setSyncLink } from "@/lib/sync/middleware";
import { REFERENCE_PRICES, referenceNeedsReview } from "@/features/prices/references";
import { buildHouseSetup, HOUSE_TEMPLATES, templateRows } from "./templates";
import { canInitializeHouse, initializeHouse } from "./service";

after(() => db.close());

test("rooms and supplies are independent: cleaning in kitchen, garage empty, no laundry", () => {
  const seed = buildHouseSetup({ rooms: ["kitchen", "garage"], groups: ["cleaning"], destinations: { cleaning: "kitchen" }, rows: templateRows(["cleaning"], "basic") }, "es");
  assert.deepEqual(seed.spaces.map((room) => room.name), ["Cocina", "Garaje"]);
  assert.equal(seed.containers[0].spaceId, seed.spaces[0].id);
  assert.ok(seed.inventory.length > 0);
  assert.throws(() => buildHouseSetup({ rooms: ["garage"], groups: ["cleaning"], destinations: { cleaning: "kitchen" }, rows: [] }, "es"));
  assert.equal(buildHouseSetup({ rooms: ["garage"], groups: [], rows: [] }, "es").containers.length, 0);
});

test("a failure during setup rolls back rooms, inventory, settings and completion marker", async () => {
  await db.delete(); await db.open();
  const fail = () => { throw new Error("Simulated storage failure"); };
  db.inventory.hook("creating", fail);
  try {
    await assert.rejects(initializeHouse({ groups: ["fridge"], rows: templateRows(["fridge"], "basic"), calendar: { country: "AR", state: "", region: "", schoolEnabled: true } }, "es"));
  } finally { db.inventory.hook("creating").unsubscribe(fail); }
  assert.equal(await db.spaces.count(), 0);
  assert.equal(await db.containers.count(), 0);
  assert.equal(await db.inventory.count(), 0);
  assert.equal(await db.houseSettings.count(), 0);
  assert.equal(await canInitializeHouse(), true);
});

test("patterns are optional, respect three levels, preserve units and keep workshops separate", () => {
  assert.deepEqual(buildHouseSetup({ groups: [], rows: [] }, "es"), { spaces: [], containers: [], inventory: [] });
  const groups = ["fridge", "cupboard", "pantry", "cleaning"];
  const all = HOUSE_TEMPLATES.map((entry) => entry.id);
  for (const locale of ["es", "en"] as const) for (const level of ["full", "basic", "low", "spaces"] as const) {
    const seed = buildHouseSetup({ groups, rows: templateRows(groups, level) }, locale);
    assert.equal(seed.containers.length, 4);
    assert.equal(new Set(seed.containers.map((entry) => entry.code)).size, 4);
    assert.equal(seed.spaces.filter((entry) => entry.kind === "workshop").length, 0);
    assert.ok(seed.inventory.every((entry) => !entry.autoSuggest && entry.minThreshold === 0));
    assert.equal(buildHouseSetup({ groups: all, rows: templateRows(all, level) }, locale).spaces.filter((entry) => entry.kind === "workshop").length, 2);
    if (level === "spaces") assert.equal(seed.inventory.length, 0);
  }
  assert.ok(templateRows(groups, "full").length > templateRows(groups, "low").length);
  const full = buildHouseSetup({ groups, rows: templateRows(groups, "full") }, "es");
  assert.equal(full.inventory.find((row) => row.name === "Aceite")?.unit, "unidades");
  assert.equal(full.inventory.find((row) => row.name === "Zanahorias")?.unit, "gr");
});

test("invalid input cannot create duplicate items, fractional stock, or unselected containers", () => {
  const row = { groupId: "fridge", catalogId: "eggs", quantity: 2 };
  assert.throws(() => buildHouseSetup({ groups: ["unknown"], rows: [] }, "es"));
  assert.throws(() => buildHouseSetup({ groups: ["fridge", "fridge"], rows: [] }, "es"));
  assert.throws(() => buildHouseSetup({ groups: [], rows: [row] }, "es"));
  assert.throws(() => buildHouseSetup({ groups: ["fridge"], rows: [row, row] }, "es"));
  for (const quantity of [-1, 0.5, NaN, Infinity, 100001]) assert.throws(() => buildHouseSetup({ groups: ["fridge"], rows: [{ ...row, quantity }] }, "es"));
  assert.throws(() => buildHouseSetup({ groups: ["fridge"], rows: [{ ...row, catalogId: "hammer" }] }, "es"));
});

test("new homes start empty; explicit setup is atomic, persists edits, and cannot overwrite on retry", async () => {
  await db.open();
  assert.equal(await db.spaces.count(), 0);
  assert.equal(await db.containers.count(), 0);
  assert.equal(await db.inventory.count(), 0);
  assert.equal(await canInitializeHouse(), true);
  const selection = { groups: ["fridge"], rows: [{ groupId: "fridge", catalogId: "eggs", quantity: 7 }] };
  const results = await Promise.all([initializeHouse(selection, "es"), initializeHouse(selection, "es")]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await db.inventory.count(), 1);
  assert.equal((await db.inventory.toArray())[0].quantity, 7);
  assert.equal(await db.prices.count(), 0);
  assert.equal(await db.shoppingCandidates.count(), 0);
  assert.equal(await canInitializeHouse(), false);
  assert.equal(await initializeHouse({ groups: [], rows: [] }, "es"), false);
});

test("starting empty is remembered; existing, protected and cloud homes cannot be initialized", async () => {
  await db.delete(); await db.open();
  assert.equal(await initializeHouse({ groups: [], rows: [] }, "es"), true);
  assert.equal(await canInitializeHouse(), false);
  await db.delete(); await db.open();
  await db.members.update("profile-admin", { name: "My household" });
  assert.equal(await canInitializeHouse(), false);
  await db.delete(); await db.open();
  await db.inventory.put({ id: "existing", name: "Custom", containerId: "missing", quantity: 1, unit: "unidades", minThreshold: 0, createdAt: 1, updatedAt: 1 });
  assert.equal(await initializeHouse({ groups: [], rows: [] }, "es"), false);
  assert.equal(await db.inventory.count(), 1);
  await db.delete(); await db.open();
  setSyncLink({ householdId: "cloud", userId: "owner", deviceId: "device" });
  try { assert.equal(await canInitializeHouse(), false); }
  finally { setSyncLink(null); }
});

test("reference prices are traceable, in cents and visibly expire; unknown prices aren't invented", () => {
  assert.equal(new Set(REFERENCE_PRICES.map((entry) => entry.catalogId)).size, REFERENCE_PRICES.length);
  for (const entry of REFERENCE_PRICES) {
    assert.ok(BASIC_CATALOG.some((product) => product.id === entry.catalogId));
    assert.ok(Number.isSafeInteger(entry.amountCents) && entry.amountCents > 0);
    assert.ok(entry.presentation && entry.store && entry.consultedAt);
    assert.equal(new URL(entry.url).protocol, "https:");
    assert.equal(referenceNeedsReview(entry, Date.parse("2026-10-15")), true);
  }
  assert.equal(referenceNeedsReview(REFERENCE_PRICES[0], Date.parse("2026-10-07T12:00:00Z")), false);
});

test("custom rooms and containers start empty, need a selected room and reject bad names", () => {
  const seed = buildHouseSetup({ rooms: ["kitchen", "attic"], groups: ["fridge"], rows: templateRows(["fridge"], "low"),
    customRooms: [{ id: "attic", name: " Altillo " }], customContainers: [{ id: "chest", name: "Baúl" }],
    destinations: { fridge: "kitchen", chest: "attic" } }, "es");
  assert.deepEqual(seed.spaces.map((room) => [room.name, room.kind]), [["Cocina", "kitchen"], ["Altillo", "other"]]);
  const chest = seed.containers.find((entry) => entry.name === "Baúl");
  assert.equal(chest?.kind, "other");
  assert.equal(chest?.spaceId, seed.spaces[1].id);
  assert.ok(seed.inventory.every((entry) => entry.containerId !== chest?.id));
  assert.throws(() => buildHouseSetup({ rooms: ["kitchen"], groups: [], rows: [], customContainers: [{ id: "chest", name: "Baúl" }], destinations: { chest: "attic" } }, "es"));
  assert.throws(() => buildHouseSetup({ rooms: ["attic"], groups: [], rows: [], customRooms: [{ id: "attic", name: "  " }] }, "es"));
  assert.throws(() => buildHouseSetup({ rooms: ["kitchen"], groups: [], rows: [], customRooms: [{ id: "kitchen", name: "Otra cocina" }] }, "es"));
});
