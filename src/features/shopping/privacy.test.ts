/**
 * Privacidad de las listas, con la base real (en memoria) y el servicio de verdad.
 */
import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { db } from "@/lib/db";
import { canSee } from "@/lib/sync/scope";
import { HOME_LIST_ID } from "./domain";
import { createList, updateList } from "./service";

const admin = { id: "profile-admin", name: "Ana", role: "admin" as const };
const adult = { id: "profile-adult", name: "Flor", role: "adult" as const };
const kid = { id: "profile-kid", name: "Tomi", role: "kid" as const };
const base = { budget: null, currency: "ARS" as const, color: "blue" as const, icon: "house" as const };

describe("privacidad de las listas", () => {
  before(() => db.open());

  test("la lista de la casa sigue siendo de la familia aunque se pida otra cosa", async () => {
    await updateList(admin, HOME_LIST_ID, { ...base, name: "Casa", privacy: "private" });
    const home = (await db.shoppingLists.get(HOME_LIST_ID))!;
    assert.equal(home.privacy, "family");
    assert.ok(canSee(kid, home));
  });

  test("una lista de Adultos no la ve un chico; una Privada, solo quien la creó", async () => {
    const gifts = await createList(admin, { ...base, name: "Regalos", privacy: "adults" });
    const diary = await createList(admin, { ...base, name: "Lo mío", privacy: "private" });
    const [adultsList, privateList] = await Promise.all([db.shoppingLists.get(gifts), db.shoppingLists.get(diary)]);
    assert.equal(canSee(kid, adultsList!), false);
    assert.equal(canSee(adult, adultsList!), true);
    assert.equal(canSee(adult, privateList!), false);
    assert.equal(canSee(admin, privateList!), true);
    // Su historial queda sellado con el mismo nivel y el mismo dueño.
    const entry = (await db.activity.where("[entityId+at]").between([diary, 0], [diary, Infinity]).first())!;
    assert.equal(entry.privacy, "private");
    assert.equal(canSee(adult, entry), false);
  });
});
