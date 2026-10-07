import { db } from "@/lib/db";
import { DEFAULT_MEMBERS } from "@/features/members/domain";
import { HOME_LIST_ID } from "@/features/shopping/domain";
import { getSyncLink } from "@/lib/sync/middleware";
import type { Locale } from "@/i18n/config";
import { buildHouseSetup, type HouseSetupSelection } from "./templates";
import { parseCalendarPreferences } from "@/features/calendar/settings";

const SETUP_KEY = "initial-house-v1";
const BASE_TABLES = new Set(["members", "shoppingLists", "syncState"]);

/** Only pristine databases can be initialized without a signed-in household profile. */
async function pristine() {
  if (getSyncLink() || await db.syncState.get(SETUP_KEY)) return false;
  for (const table of db.tables) if (!BASE_TABLES.has(table.name) && await table.count()) return false;
  const members = await db.members.toArray();
  if (members.length !== DEFAULT_MEMBERS.length || members.some((member) =>
    member.userId || member.pin || member.credentials?.length || !DEFAULT_MEMBERS.some((base) => base.id === member.id && base.name === member.name && base.role === member.role))) return false;
  const lists = await db.shoppingLists.toArray();
  return lists.length === 1 && lists[0].id === HOME_LIST_ID && lists[0].createdAt === lists[0].updatedAt;
}

export async function canInitializeHouse() {
  return db.transaction("r", db.tables, pristine);
}

/** Atomic and idempotent, including the decision to start empty. Never replaces an existing house. */
export async function initializeHouse(selection: HouseSetupSelection, locale: Locale) {
  const seed = buildHouseSetup(selection, locale);
  const calendar = selection.calendar ? parseCalendarPreferences(selection.calendar) : undefined;
  return db.transaction("rw", db.tables, async () => {
    if (!await pristine()) return false;
    await db.spaces.bulkAdd(seed.spaces);
    await db.containers.bulkAdd(seed.containers);
    await db.inventory.bulkAdd(seed.inventory);
    if (calendar) await db.houseSettings.add({ ...calendar, id: "calendar", updatedAt: Date.now() });
    await db.syncState.put({ key: SETUP_KEY, value: { at: Date.now(), groups: selection.groups } });
    return true;
  });
}
