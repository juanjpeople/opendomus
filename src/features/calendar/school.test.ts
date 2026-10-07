import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Dexie from "dexie";
import { db, declareSchema } from "@/lib/db";
import { DEFAULT_CALENDAR } from "./settings";
import { holidayOccurrences } from "./holidays";
import { applySchoolBreaks, expandEvents, parseEvent, type CalendarEvent } from "./domain";
import { createEvent, saveCalendarPreferences, updateEvent } from "./service";
import { isAllowed } from "@/lib/sync/policy";
import { shouldApplyAfterStorageUpgrade, storageCompatibleGroups } from "@/lib/sync/upgrades";

after(() => db.close());
const at = (day: number, hour = 0) => new Date(2026, 2, day, hour).getTime();
const lesson: CalendarEvent = { id: "math", title: "Matemática", start: at(2, 8), end: at(2, 9), allDay: false, repeat: "weekly", repeatUntil: at(23, 23), eventKind: "class", participantIds: ["child-a", "child-b"], color: "blue", createdAt: 0, updatedAt: 0, createdBy: "adult" };

test("school term bounds, per-pupil breaks and existing recurrences", () => {
  const closure: CalendarEvent = { ...lesson, id: "break", title: "Vacaciones", eventKind: "break", start: at(9), end: at(16), allDay: true, repeat: "none", participantIds: ["child-a"] };
  const expanded = expandEvents([lesson, closure], at(1), at(31));
  const classes = applySchoolBreaks(expanded).filter((entry) => entry.event?.eventKind === "class");
  assert.deepEqual(classes.map((entry) => new Date(entry.start).getDate()), [2, 9, 16, 23]);
  assert.deepEqual(classes.map((entry) => entry.participantIds), [["child-a", "child-b"], ["child-b"], ["child-b"], ["child-a", "child-b"]]);
  assert.throws(() => parseEvent({ ...lesson, repeatUntil: undefined }));
  assert.throws(() => parseEvent({ ...lesson, repeatUntil: at(1) }));
  assert.throws(() => parseEvent({ ...lesson, participantIds: [] }));
  assert.throws(() => parseEvent({ ...lesson, repeat: "none" }));
});

test("holidays use the chosen location and civil dates, no country inferred", () => {
  const from = new Date(2026, 6, 1).getTime(), to = new Date(2026, 6, 15).getTime();
  assert.equal(holidayOccurrences(DEFAULT_CALENDAR, from, to, "es").length, 0);
  const argentina = holidayOccurrences({ ...DEFAULT_CALENDAR, country: "AR" }, from, to, "es");
  const independence = argentina.find((entry) => entry.title.includes("Independencia"))!;
  assert.equal(new Date(independence.start).getDate(), 9);
  assert.equal(new Date(independence.start).getHours(), 0);
  assert.equal(independence.event, null);
  const usa = holidayOccurrences({ ...DEFAULT_CALENDAR, country: "US" }, from, to, "en");
  assert.ok(usa.some((entry) => new Date(entry.start).getDate() === 4));
  assert.ok(!argentina.some((entry) => entry.title.includes("Independence")));
});

test("calendar settings and school records persist and reject child writes", async () => {
  const adult = { id: "profile-admin", name: "Admin", role: "admin" as const };
  const kid = { id: "profile-kid", name: "Kid", role: "kid" as const };
  await saveCalendarPreferences(adult, { ...DEFAULT_CALENDAR, country: "AR", schoolEnabled: true });
  await assert.rejects(saveCalendarPreferences(kid, DEFAULT_CALENDAR));
  assert.equal((await db.houseSettings.get("calendar"))?.country, "AR");
  const id = await createEvent(adult, { ...lesson, participantIds: ["profile-kid"] });
  assert.equal((await db.events.get(id))?.repeatUntil, lesson.repeatUntil);
  await updateEvent(adult, id, { ...lesson, eventKind: "event", repeatUntil: undefined, participantIds: ["profile-kid"] });
  assert.equal((await db.events.get(id))?.repeatUntil, undefined);
  assert.equal(isAllowed({ userId: "kid", role: "kid" }, { t: "houseSettings", id: "calendar", k: "put", f: { schoolEnabled: true } }, undefined), false);
});

test("new settings travel separately; upgrading never replays inventory counters", () => {
  const entries = ["inventory", "houseSettings", "containerContents"].map((t, index) => ({ change: { t: t as "inventory" | "houseSettings" | "containerContents", id: String(index), k: "put" as const } }));
  const groups = storageCompatibleGroups(entries);
  assert.deepEqual(groups.map((group) => group.map((entry) => entry.change.t)), [["inventory"], ["containerContents"], ["houseSettings"]]);
  assert.equal(shouldApplyAfterStorageUpgrade(5, undefined, [entries[0].change], 10), false);
  assert.equal(shouldApplyAfterStorageUpgrade(5, undefined, [entries[1].change], 10), true);
  assert.equal(shouldApplyAfterStorageUpgrade(5, undefined, [entries[2].change], 10), false);
  assert.equal(shouldApplyAfterStorageUpgrade(5, 10, [entries[2].change], 10), true);
  assert.equal(shouldApplyAfterStorageUpgrade(11, undefined, [entries[0].change], 10), true);
});

test("v12 upgrade preserves household data and starts a settings-only backfill", async () => {
  const name = "CalendarUpgradeTest";
  const old = new Dexie(name);
  declareSchema(old, 12);
  await old.open();
  await old.table("inventory").put({ id: "milk", name: "Leche", quantity: 2 });
  await old.table("events").put(lesson);
  await old.table("syncState").put({ key: "cursor", value: 30 });
  old.close();
  const current = new Dexie(name);
  try {
    declareSchema(current); await current.open();
    assert.equal((await current.table("inventory").get("milk")).quantity, 2);
    assert.equal((await current.table("events").get("math")).title, "Matemática");
    assert.equal(await current.table("houseSettings").count(), 0);
    assert.equal((await current.table("syncState").get("houseSettingsBackfillUntil")).value, 30);
    assert.equal(await current.table("syncState").get("cursor"), undefined);
  } finally { current.close(); await Dexie.delete(name); }
});
