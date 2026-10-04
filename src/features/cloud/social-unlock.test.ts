import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { clearVault, loadIdentity } from "@/lib/cloud/vault";
import { createIdentity, derivePasswordKeys } from "@/lib/crypto";
import { unlockAuthenticatedSession } from "./service";

test("una sesión autenticada necesita abrir sus claves y nunca envía la contraseña", async (t) => {
  const user = { id: "social-user", name: "Prueba", email: "social@example.test" };
  const password = "contraseña local de prueba";
  const keys = await derivePasswordKeys(user.email, password);
  const { upload } = await createIdentity(keys.encKey);
  await clearVault();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    calls++;
    assert.equal(url, "/api/me");
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    return Response.json({ user, keys: upload, households: [] });
  });
  await assert.rejects(unlockAuthenticatedSession("contraseña incorrecta"));
  assert.equal(await loadIdentity(user.id), undefined);
  const session = await unlockAuthenticatedSession(password);
  assert.equal(session.user.id, user.id);
  assert.equal((await loadIdentity(user.id))?.email, user.email);
  assert.equal(calls, 2);
  await clearVault();
});

test("sesión ausente o sin claves no genera una identidad nueva durante el retorno social", async (t) => {
  for (const me of [{ user: null }, { user: { id: "empty", email: "empty@example.test" }, keys: null }]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json(me));
    await assert.rejects(unlockAuthenticatedSession("test"), /no-encrypted-identity/);
    assert.equal(await loadIdentity("empty"), undefined);
    mock.mock.restore();
  }
});
