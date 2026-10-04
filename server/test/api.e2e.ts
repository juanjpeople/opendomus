/**
 * Recorrido completo de la API contra un Worker local (`npm run dev:api`, con D1 local):
 * Ana crea su cuenta y su casa, invita a Flor por link, Flor se une y abre las claves de la casa.
 * Además, lo que NO tiene que poder pasar. Uso: `node --import ./scripts/test-hooks.mjs --test server/test/api.e2e.ts`
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createIdentity,
  derivePasswordKeys,
  envelopeContext,
  importScopeKey,
  inviteSecrets,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  seal,
  sealEnvelope,
  sha256,
  toB64u,
  unlockIdentity,
  type Scope,
} from "../../src/lib/crypto";

const API = process.env.API ?? "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:3000";
const FAST = 1_000;

class Client {
  cookies = new Map<string, string>();
  async call(method: string, path: string, body?: unknown, { origin = ORIGIN }: { origin?: string | null } = {}) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (origin) headers.Origin = origin;
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    // getSetCookie existe en Node (donde corre este test), no en los tipos del Worker.
    for (const cookie of (response.headers as unknown as { getSetCookie(): string[] }).getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, ...rest] = pair.split("=");
      this.cookies.set(name.trim(), rest.join("="));
    }
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
}

async function signUp(name: string, email: string, password: string) {
  const client = new Client();
  const keys = await derivePasswordKeys(email, password, FAST);
  const signUp = await client.call("POST", "/api/auth/sign-up/email", { name, email, password: keys.authKey });
  assert.equal(signUp.status, 200, JSON.stringify(signUp.body));
  const { identity, upload, recoveryCode } = await createIdentity(keys.encKey);
  assert.equal((await client.call("POST", "/api/keys", upload)).status, 201);
  const me = await client.call("GET", "/api/me");
  return { client, keys, identity, upload, recoveryCode, userId: me.body.user.id as string };
}

const unique = Date.now().toString(36);

test("cuenta, casa, invitación y unión, de punta a punta y cifrado", async () => {
  // Ana: cuenta + casa con sus tres claves de nivel.
  const ana = await signUp("Ana", `ana-${unique}@casa.test`, "una frase larga para ana");
  const householdId = crypto.randomUUID();
  const raw: Record<Scope, Uint8Array> = { family: newScopeKey(), adults: newScopeKey(), private: newScopeKey() };
  const familyKey = await importScopeKey(raw.family);
  const encryptedName = await seal(familyKey, "Casa Paredez", `household-name|${householdId}`);
  const envelopes = await Promise.all(
    (Object.keys(raw) as Scope[]).map(async (scope) => ({
      scope,
      version: 1,
      envelope: await sealEnvelope(raw[scope], ana.upload.encPublicKey, envelopeContext(householdId, scope, 1, ana.userId)),
    })),
  );
  const created = await ana.client.call("POST", "/api/households", { id: householdId, encryptedName, envelopes });
  assert.equal(created.status, 201, JSON.stringify(created.body));

  // Ana se vuelve a abrir todo desde el servidor (otro dispositivo): contraseña → identidad → sobres.
  const me = await ana.client.call("GET", "/api/me");
  assert.equal(me.body.households[0].role, "admin");
  const again = await unlockIdentity(me.body.keys, ana.keys.encKey);
  const familyEnvelope = me.body.households[0].envelopes.find((entry: { scope: string }) => entry.scope === "family");
  const opened = await openEnvelope(familyEnvelope.envelope, again, envelopeContext(householdId, "family", 1, ana.userId));
  assert.equal(await openText(opened.key, me.body.households[0].encryptedName, `household-name|${householdId}`), "Casa Paredez");

  // Invitación para Flor (adulta): las claves viajan cifradas con la clave del link.
  const invite = await inviteSecrets();
  const inviteId = crypto.randomUUID();
  const wrappedKeys = JSON.stringify({
    family: { version: 1, key: await seal(invite.wrapKey, raw.family, `invite|${inviteId}|family`) },
    adults: { version: 1, key: await seal(invite.wrapKey, raw.adults, `invite|${inviteId}|adults`) },
  });
  const createdInvite = await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: inviteId, role: "adult", tokenHash: await sha256(invite.authToken), wrappedKeys });
  assert.equal(createdInvite.status, 201, JSON.stringify(createdInvite.body));

  // Flor abre el link (sin cuenta todavía): ve quién la invita y el nombre de la casa.
  const flor = await signUp("Flor", `flor-${unique}@casa.test`, "otra frase larga para flor");
  const joinWith = await inviteSecrets(invite.secret);
  const preview = await new Client().call("POST", `/api/invites/${inviteId}/preview`, { authToken: joinWith.authToken });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.inviterName, "Ana");
  const carried = JSON.parse(preview.body.wrappedKeys);
  const florFamily = await open(joinWith.wrapKey, carried.family.key, `invite|${inviteId}|family`);
  const florAdults = await open(joinWith.wrapKey, carried.adults.key, `invite|${inviteId}|adults`);
  assert.equal(await openText(await importScopeKey(florFamily), encryptedName, `household-name|${householdId}`), "Casa Paredez");

  // Flor se une: re-ensobra las claves para sí misma y agrega su clave privada.
  const florEnvelopes = [
    { scope: "family", version: 1, envelope: await sealEnvelope(florFamily, flor.upload.encPublicKey, envelopeContext(householdId, "family", 1, flor.userId)) },
    { scope: "adults", version: 1, envelope: await sealEnvelope(florAdults, flor.upload.encPublicKey, envelopeContext(householdId, "adults", 1, flor.userId)) },
    { scope: "private", version: 1, envelope: await sealEnvelope(newScopeKey(), flor.upload.encPublicKey, envelopeContext(householdId, "private", 1, flor.userId)) },
  ];
  const accepted = await flor.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: joinWith.authToken, envelopes: florEnvelopes });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(accepted.body.role, "adult");

  const members = await ana.client.call("GET", `/api/households/${householdId}/members`);
  assert.deepEqual(members.body.members.map((member: { name: string; role: string }) => `${member.name}:${member.role}`), ["Ana:admin", "Flor:adult"]);

  // --- Lo que no tiene que pasar ---
  // La misma invitación no sirve dos veces.
  const reuse = await ana.client.call("POST", `/api/invites/${inviteId}/accept`, { authToken: joinWith.authToken, envelopes: florEnvelopes });
  assert.equal(reuse.status, 410);
  // Sin el secreto del link, la invitación "no existe".
  assert.equal((await new Client().call("POST", `/api/invites/${inviteId}/preview`, { authToken: toB64u(crypto.getRandomValues(new Uint8Array(32))) })).status, 404);
  // Flor no es admin: no puede invitar.
  assert.equal((await flor.client.call("POST", `/api/households/${householdId}/invites`, { id: crypto.randomUUID(), role: "kid", tokenHash: await sha256("x".repeat(43)), wrappedKeys })).status, 403);
  // Un chico no puede recibir la clave de "Adultos".
  const kidInvite = await inviteSecrets();
  const kidInviteId = crypto.randomUUID();
  await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: kidInviteId, role: "kid", tokenHash: await sha256(kidInvite.authToken), wrappedKeys });
  const kid = await signUp("Tomi", `tomi-${unique}@casa.test`, "frase del chico de la casa");
  const kidTry = await kid.client.call("POST", `/api/invites/${kidInviteId}/accept`, {
    authToken: kidInvite.authToken,
    envelopes: [
      { scope: "family", version: 1, envelope: await sealEnvelope(raw.family, kid.upload.encPublicKey, envelopeContext(householdId, "family", 1, kid.userId)) },
      { scope: "adults", version: 1, envelope: await sealEnvelope(raw.adults, kid.upload.encPublicKey, envelopeContext(householdId, "adults", 1, kid.userId)) },
    ],
  });
  assert.equal(kidTry.status, 400);
  // Quien no es de la casa no ve sus miembros.
  assert.equal((await kid.client.call("GET", `/api/households/${householdId}/members`)).status, 404);
  // Sin Origin (otro sitio, un script): rechazado.
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/invites`, {}, { origin: null })).status, 403);
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/invites`, {}, { origin: "https://malicioso.example" })).status, 403);
  // Una contraseña humana cruda (no derivada) no se acepta.
  const raw1 = await new Client().call("POST", "/api/auth/sign-up/email", { name: "X", email: `x-${unique}@casa.test`, password: "123456789" });
  assert.notEqual(raw1.status, 200);
  // Sin sesión, nada.
  assert.equal((await new Client().call("GET", "/api/me")).status, 401);
});
