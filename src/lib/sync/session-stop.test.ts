import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createIdentity, derivePasswordKeys } from "@/lib/crypto";
import { db } from "@/lib/db";
import { startSync, syncNow } from "./engine";
import { useSyncStatus } from "./status";

for (const code of [401, 404]) {
  test(`una respuesta ${code} detiene los reintentos sin borrar la copia local`, async (t) => {
    let stop: () => void = () => undefined;
    t.after(() => stop());
    const windowEvents = Object.assign(new EventTarget(), { location: { origin: "https://test.example" } });
    const documentEvents = Object.assign(new EventTarget(), { visibilityState: "visible" });
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      static OPEN = 1;
      readyState = 1;
      onclose: ((event: { code: number }) => void) | null = null;
      constructor() { sockets.push(this); }
      close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
    }
    for (const [name, value] of Object.entries({ window: windowEvents, document: documentEvents, navigator: { onLine: true }, WebSocket: FakeSocket })) {
      const previous = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, { value, configurable: true });
      t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
    const periodic: Array<() => void> = [];
    t.mock.method(globalThis, "setInterval", (callback: () => void) => { periodic.push(callback); return 1; });
    t.mock.method(globalThis, "clearInterval", () => {});
    let requests = 0;
    t.mock.method(globalThis, "fetch", async () => {
      requests++;
      return Response.json({ error: code === 401 ? "unauthorized" : "not-found" }, { status: code });
    });
    await db.open();
    const before = await db.containers.count();
    assert.ok(before > 0);
    const keys = await derivePasswordKeys("test@example.com", "test password", 1000);
    const { identity } = await createIdentity(keys.encKey);
    useSyncStatus.getState().update({ error: null, phase: "off" });
    const terminal = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { unsubscribe(); reject(new Error("sync did not stop")); }, 3000);
      const unsubscribe = useSyncStatus.subscribe((state) => {
        if (state.error === (code === 401 ? "session" : "removed")) {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
    stop = startSync({
      link: { householdId: "house", userId: "user", deviceId: "device" },
      identity, writeKeys: {}, readKey: async () => null, fetchRoster: async () => new Map(),
    });
    await terminal;
    assert.equal(sockets.length, 1);
    assert.equal(sockets[0].readyState, 3);
    const count = requests;
    syncNow();
    windowEvents.dispatchEvent(new Event("online"));
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    periodic.forEach((callback) => callback());
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(requests, count);
    assert.equal(sockets.length, 1);
    assert.equal(await db.containers.count(), before);
  });
}
