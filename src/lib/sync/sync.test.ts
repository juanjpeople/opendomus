import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { acknowledge, applyRemote, markRescope, outgoing, recordKey, trackLocal, type Change, type Row, type SyncRecord } from "./merge";
import { isAllowed } from "./policy";
import type { SyncScope } from "./protocol";
import { parentOf, resolveScope } from "./scope";
import type { SyncTable } from "./tables";

/** Un servidor de mentira: guarda los cambios en orden, como el Durable Object. */
class Server {
  log: { seq: number; scope: SyncScope; change: Change; device: string }[] = [];
  append(device: string, scope: SyncScope, change: Change) {
    const seq = this.log.length + 1;
    this.log.push({ seq, scope, change: structuredClone(change), device });
    return seq;
  }
}

/** Un dispositivo: sus filas, el estado de sincronización y hasta dónde bajó. */
class Device {
  rows = new Map<string, Row>();
  meta = new Map<string, SyncRecord>();
  cursor = 0;
  readonly name: string;
  readonly scopes: SyncScope[];
  constructor(name: string, scopes: SyncScope[] = ["family", "adults", "private"]) {
    this.name = name;
    this.scopes = scopes;
  }

  get(table: SyncTable, id: string) {
    return this.rows.get(recordKey(table, id));
  }

  write(table: SyncTable, id: string, update: (row: Row | undefined) => Row | undefined) {
    const key = recordKey(table, id);
    const before = this.rows.get(key);
    const after = update(before && structuredClone(before));
    if (after) this.rows.set(key, after);
    else this.rows.delete(key);
    const next = trackLocal(this.meta.get(key), table, id, before, after);
    if (next === null) this.meta.delete(key);
    else if (next) this.meta.set(key, next);
  }

  push(server: Server, scopeOf: (table: SyncTable, row: Row) => SyncScope = () => "family") {
    for (const [key, meta] of this.meta) {
      if (!meta.pending) continue;
      const row = this.rows.get(key);
      const out = outgoing(meta, row, row ? scopeOf(meta.t, row) : (meta.scope ?? "family"));
      if (!out) continue;
      let seq: number | undefined;
      for (const { scope, change } of out.changes) seq = server.append(this.name, scope, change);
      this.meta.set(key, acknowledge(meta, out.sent, seq));
    }
  }

  pull(server: Server) {
    for (const entry of server.log.filter((op) => op.seq > this.cursor)) {
      this.cursor = entry.seq;
      if (entry.device === this.name || !this.scopes.includes(entry.scope)) continue;
      const key = recordKey(entry.change.t, entry.change.id);
      const result = applyRemote(this.meta.get(key), this.rows.get(key), entry.change, entry.seq, entry.scope);
      this.meta.set(key, result.meta);
      if (result.row === null) this.rows.delete(key);
      else if (result.row) this.rows.set(key, result.row);
    }
  }
}

const milk = (quantity = 3): Row => ({ id: "leche", name: "Leche", quantity, unit: "u", updatedAt: 1 });

function household() {
  const server = new Server();
  const ana = new Device("ana");
  const flor = new Device("flor");
  ana.write("inventory", "leche", () => milk());
  ana.push(server);
  flor.pull(server);
  return { server, ana, flor };
}

describe("sincronización: cómo se juntan los cambios", () => {
  test("lo que crea un dispositivo llega entero al otro", () => {
    const { flor } = household();
    assert.deepEqual(flor.get("inventory", "leche"), milk());
  });

  test("dos consumos simultáneos se suman, no se pisan", () => {
    const { server, ana, flor } = household();
    ana.write("inventory", "leche", (row) => ({ ...row!, quantity: 2 }));
    flor.write("inventory", "leche", (row) => ({ ...row!, quantity: 2 }));
    ana.push(server);
    flor.push(server);
    ana.pull(server);
    flor.pull(server);
    assert.equal(ana.get("inventory", "leche")!.quantity, 1);
    assert.equal(flor.get("inventory", "leche")!.quantity, 1);
  });

  test("ediciones de campos distintos quedan las dos; en el mismo campo gana la última del servidor", () => {
    const { server, ana, flor } = household();
    ana.write("inventory", "leche", (row) => ({ ...row!, name: "Leche descremada", unit: "l" }));
    flor.write("inventory", "leche", (row) => ({ ...row!, unit: "cartón", notes: "La de caja azul" }));
    ana.push(server);
    flor.push(server); // queda después: su "unidad" gana
    ana.pull(server);
    flor.pull(server);
    for (const device of [ana, flor]) {
      const row = device.get("inventory", "leche")!;
      assert.equal(row.name, "Leche descremada");
      assert.equal(row.unit, "cartón");
      assert.equal(row.notes, "La de caja azul");
    }
  });

  test("lo que todavía no se subió no lo pisa un cambio más viejo", () => {
    const { server, ana, flor } = household();
    ana.write("inventory", "leche", (row) => ({ ...row!, name: "Leche de Ana" }));
    ana.push(server);
    flor.write("inventory", "leche", (row) => ({ ...row!, name: "Leche de Flor" }));
    flor.pull(server); // llega lo de Ana, pero Flor tiene su cambio pendiente
    assert.equal(flor.get("inventory", "leche")!.name, "Leche de Flor");
    flor.push(server);
    ana.pull(server);
    assert.equal(ana.get("inventory", "leche")!.name, "Leche de Flor");
  });

  test("borrar gana sobre editar, en cualquier orden", () => {
    const { server, ana, flor } = household();
    flor.write("inventory", "leche", (row) => ({ ...row!, name: "Leche entera" }));
    ana.write("inventory", "leche", () => undefined);
    ana.push(server);
    flor.push(server); // la edición llega después del borrado
    ana.pull(server);
    flor.pull(server);
    assert.equal(ana.get("inventory", "leche"), undefined);
    assert.equal(flor.get("inventory", "leche"), undefined);
  });

  test("algo creado y borrado antes de subirse no viaja nunca", () => {
    const { server, ana } = household();
    ana.write("inventory", "pan", () => ({ id: "pan", name: "Pan", quantity: 1 }));
    ana.write("inventory", "pan", () => undefined);
    const before = server.log.length;
    ana.push(server);
    assert.equal(server.log.length, before);
    assert.equal(ana.meta.has(recordKey("inventory", "pan")), false);
  });

  test("lo borrado acá por otro se avisa: también lo que llegó de otro dispositivo", () => {
    const { server, ana, flor } = household();
    flor.write("inventory", "leche", () => undefined);
    flor.push(server);
    ana.pull(server);
    assert.equal(ana.get("inventory", "leche"), undefined);
  });

  test("un cambio parcial de algo que no existe acá no lo crea a medias", () => {
    const device = new Device("tomi");
    const result = applyRemote(undefined, undefined, { t: "inventory", id: "x", k: "put", f: { name: "Solo el nombre" } }, 9, "family");
    assert.equal(result.row, undefined);
    device.pull(new Server());
    assert.equal(device.rows.size, 0);
  });

  test("el PIN y las huellas no salen del dispositivo ni se pisan con lo que llega", () => {
    const server = new Server();
    const ana = new Device("ana");
    const flor = new Device("flor");
    const pin = { hash: "h", salt: "s", iterations: 1 };
    ana.write("members", "m1", () => ({ id: "m1", name: "Ana", role: "admin", pin }));
    ana.push(server);
    assert.equal("pin" in (server.log[0].change.f ?? {}), false);
    flor.pull(server);
    assert.equal(flor.get("members", "m1")!.pin, undefined);
    flor.write("members", "m1", (row) => ({ ...row!, pin: { hash: "otro", salt: "x", iterations: 1 }, name: "Ana P." }));
    flor.push(server);
    ana.pull(server);
    assert.deepEqual(ana.get("members", "m1")!.pin, pin);
    assert.equal(ana.get("members", "m1")!.name, "Ana P.");
  });

  test("un cambio hecho mientras se subía el anterior no se pierde", () => {
    const server = new Server();
    const ana = new Device("ana");
    ana.write("inventory", "leche", () => milk());
    ana.push(server);
    ana.write("inventory", "leche", (row) => ({ ...row!, name: "Uno", quantity: 2 }));
    const key = recordKey("inventory", "leche");
    const out = outgoing(ana.meta.get(key)!, ana.rows.get(key), "family")!;
    ana.write("inventory", "leche", (row) => ({ ...row!, name: "Dos", quantity: 1 })); // mientras viajaba
    const acked = acknowledge(ana.meta.get(key)!, out.sent, 7);
    assert.equal(acked.pending, 1);
    assert.ok("name" in acked.dirty);
    assert.deepEqual(acked.deltas, { quantity: -1 });
  });

  test("al crearse, la cantidad llega como valor; después, solo como diferencias", () => {
    const result = applyRemote(undefined, { id: "leche", name: "Leche", quantity: 5 }, { t: "inventory", id: "leche", k: "put", full: true, f: { name: "Leche", quantity: 99 } }, 3, "family");
    assert.equal(result.row && result.row.quantity, 5);
  });
});

describe("sincronización: niveles de privacidad", () => {
  const scopeOf = (device: Device) => (table: SyncTable, row: Row) => resolveScope(table, row, async (parent, id) => device.get(parent, id));

  test("lo de una lista hereda su nivel; el historial de compras, el de su lista", async () => {
    const rows: Record<string, Row> = { "shoppingLists|regalos": { id: "regalos", privacy: "adults" } };
    const get = async (table: SyncTable, id: string) => rows[`${table}|${id}`];
    assert.equal(await resolveScope("shoppingList", { id: "i", listId: "regalos" }, get), "adults");
    assert.equal(await resolveScope("activity", { id: "a", module: "shopping", entityId: "Bici", listId: "regalos" }, get), "adults");
    assert.equal(await resolveScope("inventory", { id: "x" }, get), "family");
    assert.equal(await resolveScope("recipes", { id: "r", privacy: "rara" }, get), "family");
    assert.deepEqual(parentOf("comments", { id: "c", ownerType: "recipe", ownerId: "r1" }), { table: "recipes", id: "r1" });
    // Si la lista ya no está (se borró), queda donde se publicó.
    assert.equal(await resolveScope("shoppingList", { id: "i", listId: "otra" }, get, "adults"), "adults");
  });

  test("pasar una lista a Adultos la saca de los dispositivos de los chicos", async () => {
    const server = new Server();
    const ana = new Device("ana");
    const tomi = new Device("tomi", ["family", "private"]);
    const flor = new Device("flor");
    const sync = async (device: Device) => {
      for (const [key, meta] of device.meta) {
        if (!meta.pending) continue;
        const row = device.rows.get(key);
        const scope = row ? await scopeOf(device)(meta.t, row) : (meta.scope ?? "family");
        const out = outgoing(meta, row, scope);
        if (!out) continue;
        let seq: number | undefined;
        for (const { scope: target, change } of out.changes) seq = server.append(device.name, target, change);
        device.meta.set(key, acknowledge(meta, out.sent, seq));
      }
    };
    ana.write("shoppingLists", "regalos", () => ({ id: "regalos", name: "Regalos" }));
    ana.write("shoppingList", "bici", () => ({ id: "bici", name: "Bici", listId: "regalos" }));
    await sync(ana);
    tomi.pull(server);
    flor.pull(server);
    assert.ok(tomi.get("shoppingList", "bici"));

    ana.write("shoppingLists", "regalos", (row) => ({ ...row!, privacy: "adults" }));
    const key = recordKey("shoppingList", "bici");
    ana.meta.set(key, markRescope(ana.meta.get(key), "shoppingList", "bici")!);
    await sync(ana);
    tomi.pull(server);
    flor.pull(server);
    assert.equal(tomi.get("shoppingLists", "regalos"), undefined);
    assert.equal(tomi.get("shoppingList", "bici"), undefined);
    // Flor (adulta) la sigue teniendo, entera, ahora en Adultos.
    assert.equal(flor.get("shoppingList", "bici")!.name, "Bici");
    assert.equal(flor.get("shoppingLists", "regalos")!.privacy, "adults");
    assert.equal(flor.meta.get(key)!.scope, "adults");
    // Las ediciones de Tomi (que ya no la ve) no la reviven a medias.
    assert.equal(server.log.filter((op) => op.scope === "family" && op.change.k === "del" && op.change.moved).length, 2);
  });
});

describe("sincronización: permisos verificados en cada dispositivo", () => {
  const admin = { userId: "ana", role: "admin" as const };
  const adult = { userId: "flor", role: "adult" as const };
  const kid = { userId: "tomi", role: "kid" as const };
  const put = (t: SyncTable, extra: Partial<Change> = {}): Change => ({ t, id: "x", k: "put", f: { name: "x" }, ...extra });

  test("un chico no cambia el inventario, las listas ni el calendario, aunque arme el pedido a mano", () => {
    for (const table of ["inventory", "shoppingList", "shoppingLists", "events", "recipes", "projects", "spaces", "prices"] as const) {
      assert.equal(isAllowed(kid, put(table), undefined), false, table);
      assert.equal(isAllowed(kid, { t: table, id: "x", k: "del" }, undefined), false, table);
    }
    assert.equal(isAllowed(kid, { t: "inventory", id: "leche", k: "put", d: { quantity: -1 } }, milk()), false);
  });

  test("un chico sí comenta y edita su propio perfil, sin cambiarse el rol", () => {
    assert.equal(isAllowed(kid, put("comments", { full: true }), undefined), true);
    const own = { id: "m", name: "Tomi", role: "kid", userId: "tomi" };
    assert.equal(isAllowed(kid, { t: "members", id: "m", k: "put", f: { emoji: "🦖" } }, own), true);
    assert.equal(isAllowed(kid, { t: "members", id: "m", k: "put", f: { role: "admin" } }, own), false);
    assert.equal(isAllowed(kid, { t: "members", id: "m", k: "put", f: { name: "Ana" } }, { ...own, userId: "ana" }), false);
    assert.equal(isAllowed(kid, { t: "members", id: "m", k: "put", u: ["userId"] }, own), false);
  });

  test("al unirse, cada uno se queda con un perfil libre de su mismo rol, no con otro", () => {
    const free = { id: "profile-adult", name: "Adulto", role: "adult" };
    assert.equal(isAllowed(adult, { t: "members", id: free.id, k: "put", f: { userId: "flor", name: "Flor" } }, free), true);
    assert.equal(isAllowed(adult, { t: "members", id: "p", k: "put", f: { userId: "flor" } }, { id: "p", name: "Admin", role: "admin" }), false);
    assert.equal(isAllowed(kid, { t: "members", id: "new", k: "put", full: true, f: { userId: "tomi", role: "kid", name: "Tomi" } }, undefined), true);
    assert.equal(isAllowed(kid, { t: "members", id: "new", k: "put", full: true, f: { userId: "tomi", role: "adult", name: "Tomi" } }, undefined), false);
  });

  test("un adulto maneja la casa pero no los miembros ni el historial", () => {
    assert.equal(isAllowed(adult, put("inventory"), undefined), true);
    assert.equal(isAllowed(adult, { t: "inventory", id: "x", k: "del" }, undefined), true);
    assert.equal(isAllowed(adult, put("members"), { id: "x", name: "Ana", role: "admin", userId: "ana" }), false);
    assert.equal(isAllowed(adult, { t: "activity", id: "x", k: "del" }, undefined), false);
    assert.equal(isAllowed(admin, { t: "activity", id: "x", k: "del" }, undefined), true);
  });
});
