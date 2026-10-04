/**
 * Recorrido completo de la API contra un Worker local (`npm run dev:api`, con D1 local):
 * Ana crea su cuenta y su casa, invita a Flor por link, Flor se une y abre las claves de la casa.
 * Además, lo que NO tiene que poder pasar. Uso: `node --import ./scripts/test-hooks.mjs --test server/test/api.e2e.ts`
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createIdentity,
  derivePasswordKeys,
  envelopeContext,
  importScopeKey,
  inviteSecrets,
  newRecoveryKit,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  recoverIdentity,
  recoveryProof,
  rewrapIdentity,
  seal,
  sealEnvelope,
  sha256,
  sign,
  toB64u,
  unlockIdentity,
  verify,
  type Identity,
  type Scope,
} from "../../src/lib/crypto";
import { opContext, opSigningData, type StoredOp, type WireOp } from "../../src/lib/sync/protocol";

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

/** Token de administración del Worker local (de `.dev.vars`, o del entorno en CI). */
function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  return vars.match(/^ADMIN_TOKEN=(.+)$/m)?.[1].trim() ?? "";
}

async function adminCall(method: "GET" | "POST", path: string, body?: unknown, token = adminToken()) {
  const response = await fetch(`${API}/api/admin${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

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
  // --- Licencias: la nube es opcional y crear una casa pide una (la emite Juan, o mañana el cobro) ---
  assert.equal((await adminCall("GET", "/licenses", undefined, "")).status, 401);
  assert.equal((await adminCall("GET", "/licenses", undefined, "x".repeat(48))).status, 401);
  const issued = await adminCall("POST", "/licenses", { count: 2, note: `prueba ${unique}` });
  assert.equal(issued.status, 201, JSON.stringify(issued.body));
  const [license, spare] = issued.body.licenses as { id: string; code: string }[];
  assert.match(license.code, /^OD(-[A-Z2-9]{4}){4}$/);
  // Se valida antes de crear la cuenta, sin consumirla; con guiones o sin, en minúscula o mayúscula.
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: license.code.toLowerCase().replace(/-/g, " ") })).body.valid, true);
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: "OD-AAAA-AAAA-AAAA-AAAA" })).body.valid, false);
  const createWith = (accessCode?: string) => ana.client.call("POST", "/api/households", { id: householdId, encryptedName, envelopes, accessCode });
  assert.equal((await createWith()).status, 403);
  assert.equal((await createWith("OD-AAAA-AAAA-AAAA-AAAA")).status, 403);
  // Una licencia revocada no sirve.
  assert.equal((await adminCall("POST", `/licenses/${spare.id}/revoke`)).status, 200);
  assert.equal((await createWith(spare.code)).status, 403);
  const created = await createWith(license.code);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  // Usada una vez (una casa por licencia): ya no sirve para otra.
  assert.equal((await new Client().call("POST", "/api/licenses/check", { code: license.code })).body.valid, false);
  const second = await ana.client.call("POST", "/api/households", { id: crypto.randomUUID(), encryptedName, envelopes, accessCode: license.code });
  assert.equal(second.status, 403);

  // Ana se vuelve a abrir todo desde el servidor (otro dispositivo): contraseña → identidad → sobres.
  const me = await ana.client.call("GET", "/api/me");
  assert.equal(me.body.households[0].role, "admin");
  assert.equal(me.body.households[0].plan, "beta");
  assert.equal(me.body.households[0].planStatus, "active");
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
  // Sin sesión, nada: /me responde que no hay nadie y lo demás exige sesión.
  assert.equal((await new Client().call("GET", "/api/me")).body.user, null);
  assert.equal((await new Client().call("GET", `/api/households/${householdId}/members`)).status, 401);

  // --- Sincronización: operaciones cifradas y firmadas ---
  const anaFamily = familyKey;
  const anaAdults = await importScopeKey(raw.adults);
  const anaPrivate = await importScopeKey(raw.private);
  const op = async (who: { identity: Identity; userId: string }, scope: Scope, key: CryptoKey, payload: unknown, overrides: Partial<WireOp> = {}) => {
    const base = { id: crypto.randomUUID(), scope, keyVersion: 1, ...overrides };
    const body = overrides.body ?? (await seal(key, JSON.stringify(payload), opContext(householdId, base, who.userId)));
    const unsigned = { ...base, body, sig: "" };
    return { ...unsigned, sig: overrides.sig ?? (await sign(who.identity, opSigningData(householdId, unsigned, who.userId))) };
  };
  const push = (who: { client: Client }, ops: WireOp[]) => who.client.call("POST", `/api/households/${householdId}/ops`, { ops });
  const pull = (who: { client: Client }, since = 0) => who.client.call("GET", `/api/households/${householdId}/ops?since=${since}`);

  const leche = await op(ana, "family", anaFamily, { changes: [{ t: "inventory", id: "leche", k: "put", f: { name: "Leche" } }] });
  const first = await push(ana, [leche]);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  // Reintentar lo mismo (se cortó la conexión antes de la respuesta) no duplica: mismo número.
  assert.deepEqual((await push(ana, [leche])).body.acks, first.body.acks);
  const regalo = await op(ana, "adults", anaAdults, { changes: [{ t: "shoppingList", id: "regalo", k: "put", f: { name: "Regalo de Tomi" } }] });
  const diario = await op(ana, "private", anaPrivate, { changes: [{ t: "events", id: "diario", k: "put", f: { title: "Solo mío" } }] });
  assert.equal((await push(ana, [regalo, diario])).status, 200);

  // Flor (adulta) baja Familia y Adultos, no lo privado de Ana. Abre y verifica cada operación.
  const florPull = await pull(flor);
  assert.equal(florPull.status, 200);
  assert.deepEqual(florPull.body.ops.map((stored: StoredOp) => stored.id), [leche.id, regalo.id]);
  const stored: StoredOp = florPull.body.ops[0];
  assert.equal(stored.author, ana.userId);
  assert.ok(await verify(ana.upload.signPublicKey, opSigningData(householdId, stored, stored.author), stored.sig));
  assert.deepEqual(JSON.parse(await openText(await importScopeKey(florFamily), stored.body, opContext(householdId, stored, stored.author))).changes[0].f, { name: "Leche" });
  assert.equal(florPull.body.next, florPull.body.head);
  // Pedir desde el último número no trae nada nuevo.
  assert.equal((await pull(flor, florPull.body.next)).body.ops.length, 0);

  // Un chico de verdad (Familia + su Privado) baja solo Familia y no puede escribir en Adultos.
  const kidInvite2 = await inviteSecrets();
  const kidInvite2Id = crypto.randomUUID();
  await ana.client.call("POST", `/api/households/${householdId}/invites`, { id: kidInvite2Id, role: "kid", tokenHash: await sha256(kidInvite2.authToken), wrappedKeys });
  const kidJoin = await kid.client.call("POST", `/api/invites/${kidInvite2Id}/accept`, {
    authToken: kidInvite2.authToken,
    envelopes: [
      { scope: "family", version: 1, envelope: await sealEnvelope(raw.family, kid.upload.encPublicKey, envelopeContext(householdId, "family", 1, kid.userId)) },
      { scope: "private", version: 1, envelope: await sealEnvelope(newScopeKey(), kid.upload.encPublicKey, envelopeContext(householdId, "private", 1, kid.userId)) },
    ],
  });
  assert.equal(kidJoin.status, 201, JSON.stringify(kidJoin.body));
  assert.deepEqual((await pull(kid)).body.ops.map((stored: StoredOp) => stored.id), [leche.id]);
  assert.equal((await push(kid, [await op(kid, "adults", anaAdults, { changes: [] })])).status, 403);

  // Firmas: una operación firmada por otra persona, o modificada después de firmar, no entra.
  const forged = await op(flor, "family", anaFamily, { changes: [] });
  assert.equal((await push(ana, [forged])).status, 400);
  const tampered = await op(ana, "family", anaFamily, { changes: [] });
  assert.equal((await push(ana, [{ ...tampered, body: leche.body }])).status, 400);
  // El servidor tampoco puede cambiar de nivel una operación: deja de abrir en el dispositivo.
  const moved = { ...stored, scope: "adults" as const };
  await assert.rejects(openText(await importScopeKey(florFamily), moved.body, opContext(householdId, moved, moved.author)));
  // Versión de clave vieja o futura: rechazada.
  assert.equal((await push(ana, [await op(ana, "family", anaFamily, { changes: [] }, { keyVersion: 2 })])).status, 409);
  // Reusar el id de una operación ajena: conflicto.
  assert.equal((await push(flor, [await op(flor, "family", anaFamily, { changes: [] }, { id: leche.id })])).status, 409);
  // Sin Origin, sin sesión o sin ser de la casa: nada.
  assert.equal((await ana.client.call("POST", `/api/households/${householdId}/ops`, { ops: [leche] }, { origin: null })).status, 403);
  assert.equal((await new Client().call("GET", `/api/households/${householdId}/ops`)).status, 401);

  // Avisos en tiempo real: sin Origin conocido, rechazado; con sesión y Origin, llega el último número.
  const live = (origin: string, client: Client | null) =>
    new Promise<number | "rejected">((resolve) => {
      const headers: Record<string, string> = { Origin: origin };
      if (client) headers.Cookie = [...client.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      // Node acepta encabezados al abrir un WebSocket (el navegador manda Origin y cookies solo).
      const socket = new WebSocket(`${API.replace(/^http/, "ws")}/api/households/${householdId}/live`, { headers } as unknown as string[]);
      socket.onmessage = (event) => {
        resolve(JSON.parse(String(event.data)).seq);
        socket.close();
      };
      socket.onerror = () => resolve("rejected");
    });
  assert.equal(await live("https://malicioso.example", flor.client), "rejected");
  assert.equal(await live(ORIGIN, null), "rejected");
  // Lo rechazado nunca llegó al registro: siguen siendo las tres operaciones de Ana.
  assert.equal(await live(ORIGIN, flor.client), florPull.body.head);

  // --- Recuperar con el kit (sin sesión, sin email) ---
  const anaEmail = `ana-${unique}@casa.test`;
  const recovery = (path: string, body: unknown) => new Client().call("POST", `/api/recovery/${path}`, body);
  const otherKit = (await createIdentity((await derivePasswordKeys("x@x.test", "x", FAST)).encKey)).recoveryCode;
  // Kit equivocado o email sin cuenta: la misma respuesta (no revela qué emails existen).
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(otherKit) })).status, 403);
  assert.equal((await recovery("start", { email: `nadie-${unique}@casa.test`, recoveryAuth: await recoveryProof(ana.recoveryCode) })).status, 403);
  const started = await recovery("start", { email: anaEmail.toUpperCase(), recoveryAuth: await recoveryProof(ana.recoveryCode) });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.recoveryPrivateKeys, ana.upload.recoveryPrivateKeys);
  const anaNew = await derivePasswordKeys(anaEmail, "la contraseña nueva de ana", FAST);
  const recovered = await recoverIdentity(started.body, ana.recoveryCode, anaNew.encKey);
  const completed = await recovery("complete", {
    email: anaEmail,
    recoveryAuth: await recoveryProof(ana.recoveryCode),
    newPassword: anaNew.authKey,
    privateKeys: recovered.privateKeys,
    recoveryPrivateKeys: recovered.kit.recoveryPrivateKeys,
    recoveryVerifier: recovered.kit.recoveryVerifier,
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  // Se cerraron todas las sesiones; la contraseña vieja ya no entra y el kit usado ya no sirve.
  assert.equal((await ana.client.call("GET", "/api/me")).body.user, null);
  assert.notEqual((await new Client().call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: ana.keys.authKey })).status, 200);
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(ana.recoveryCode) })).status, 403);
  const anaAgain = new Client();
  assert.equal((await anaAgain.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaNew.authKey })).status, 200);
  const meAgain = await anaAgain.call("GET", "/api/me");
  assert.equal((await unlockIdentity(meAgain.body.keys, anaNew.encKey)).signPublicKey, ana.upload.signPublicKey);

  // --- Cambiar la contraseña y pedir un kit nuevo (con sesión) ---
  const anaThird = await derivePasswordKeys(anaEmail, "tercera contraseña de ana", FAST);
  const rewrapped = await rewrapIdentity(meAgain.body.keys.privateKeys, anaNew.encKey, anaThird.encKey);
  assert.equal((await anaAgain.call("POST", "/api/account/password", { currentPassword: anaThird.authKey, newPassword: anaThird.authKey, privateKeys: rewrapped })).status, 403);
  const anaOtherDevice = new Client();
  await anaOtherDevice.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaNew.authKey });
  assert.equal((await anaAgain.call("POST", "/api/account/password", { currentPassword: anaNew.authKey, newPassword: anaThird.authKey, privateKeys: rewrapped })).status, 200);
  // Esta sesión sigue; la del otro dispositivo se cerró.
  assert.ok((await anaAgain.call("GET", "/api/me")).body.user);
  assert.equal((await anaOtherDevice.call("GET", "/api/me")).body.user, null);
  const freshKit = await newRecoveryKit(rewrapped, anaThird.encKey);
  assert.equal((await anaAgain.call("POST", "/api/account/recovery-kit", { password: anaNew.authKey, ...freshKit })).status, 403);
  assert.equal((await anaAgain.call("POST", "/api/account/recovery-kit", { password: anaThird.authKey, ...freshKit })).status, 200);
  assert.equal((await recovery("start", { email: anaEmail, recoveryAuth: await recoveryProof(freshKit.recoveryCode) })).status, 200);

  // --- Dispositivos: se ven sin tokens y se cierra uno ---
  const tablet = new Client();
  await tablet.call("POST", "/api/auth/sign-in/email", { email: anaEmail, password: anaThird.authKey }, { origin: ORIGIN });
  const devices = await anaAgain.call("GET", "/api/account/devices");
  assert.equal(devices.body.devices.length, 2);
  assert.equal(devices.body.devices.filter((device: { current: boolean }) => device.current).length, 1);
  assert.ok(devices.body.devices.every((device: Record<string, unknown>) => !("token" in device)));
  const other = devices.body.devices.find((device: { current: boolean }) => !device.current);
  assert.equal((await anaAgain.call("DELETE", `/api/account/devices/${other.id}`)).status, 200);
  assert.equal((await tablet.call("GET", "/api/me")).body.user, null);

  // --- Sacar a Flor: claves nuevas de Familia y Adultos para los que quedan ---
  const anaIdentity = await unlockIdentity(meAgain.body.keys, anaNew.encKey);
  const roster = (await anaAgain.call("GET", `/api/households/${householdId}/members`)).body.members as { userId: string; role: string; encPublicKey: string }[];
  const remaining = roster.filter((member) => member.userId !== flor.userId);
  const newFamily = newScopeKey();
  const newAdults = newScopeKey();
  const wrapFor = (raw: Uint8Array, scope: Scope, members: typeof remaining) =>
    Promise.all(members.map(async (member) => ({ userId: member.userId, envelope: await sealEnvelope(raw, member.encPublicKey, envelopeContext(householdId, scope, 2, member.userId)) })));
  const removal = {
    encryptedName: await seal(await importScopeKey(newFamily), "Casa Paredez", `household-name|${householdId}`),
    rotation: [
      { scope: "family", version: 2, envelopes: await wrapFor(newFamily, "family", remaining) },
      { scope: "adults", version: 2, envelopes: await wrapFor(newAdults, "adults", remaining.filter((member) => member.role !== "kid")) },
    ],
  };
  // Faltando alguien (Tomi) en los sobres: hay que rearmarlos. Flor no puede sacar a nadie.
  const missingTomi = { ...removal, rotation: [{ ...removal.rotation[0], envelopes: removal.rotation[0].envelopes.filter((entry) => entry.userId !== kid.userId) }, removal.rotation[1]] };
  assert.equal((await anaAgain.call("POST", `/api/households/${householdId}/members/${flor.userId}/remove`, missingTomi)).status, 409);
  assert.equal((await flor.client.call("POST", `/api/households/${householdId}/members/${kid.userId}/remove`, removal)).status, 403);
  const removed = await anaAgain.call("POST", `/api/households/${householdId}/members/${flor.userId}/remove`, removal);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  // Flor ya no entra a nada de la casa.
  assert.equal((await flor.client.call("GET", `/api/households/${householdId}/members`)).status, 404);
  assert.equal((await pull(flor)).status, 404);
  // La casa sigue legible con la Familia nueva; lo viejo, con la vieja (Ana guarda los dos sobres).
  const afterRemoval = (await anaAgain.call("GET", "/api/me")).body.households[0];
  assert.equal(afterRemoval.familyKeyVersion, 2);
  const family2 = afterRemoval.envelopes.find((entry: { scope: string; version: number }) => entry.scope === "family" && entry.version === 2);
  const opened2 = await openEnvelope(family2.envelope, anaIdentity, envelopeContext(householdId, "family", 2, ana.userId));
  assert.equal(await openText(opened2.key, afterRemoval.encryptedName, `household-name|${householdId}`), "Casa Paredez");
  // Flor sigue en la lista como ex miembro (para verificar sus cambios viejos), con su clave de firma.
  const withFormer = (await anaAgain.call("GET", `/api/households/${householdId}/members`)).body;
  assert.deepEqual(withFormer.former.map((member: { userId: string; signPublicKey: string }) => [member.userId, member.signPublicKey]), [[flor.userId, flor.upload.signPublicKey]]);
  // Lo nuevo se escribe con la versión nueva; con la vieja, se rechaza.
  const anaSigner = { identity: anaIdentity, userId: ana.userId, client: anaAgain };
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", anaFamily, { changes: [] })])).status, 409);
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })])).status, 200);

  // --- Pasar a alguien a chico rota la clave de Adultos (ya la tenía) ---
  const membersPath = `/api/households/${householdId}/members/${kid.userId}`;
  assert.equal((await anaAgain.call("PATCH", membersPath, { role: "adult" })).status, 200);
  assert.equal((await anaAgain.call("PATCH", membersPath, { role: "kid" })).status, 400);
  const adults3 = newScopeKey();
  const demote = { role: "kid", rotation: { version: 3, envelopes: [{ userId: ana.userId, envelope: await sealEnvelope(adults3, ana.upload.encPublicKey, envelopeContext(householdId, "adults", 3, ana.userId)) }] } };
  assert.equal((await anaAgain.call("PATCH", membersPath, { ...demote, rotation: { ...demote.rotation, version: 2 } })).status, 409);
  assert.equal((await anaAgain.call("PATCH", membersPath, demote)).status, 200);
  assert.equal((await anaAgain.call("GET", "/api/me")).body.households[0].adultsKeyVersion, 3);

  // --- Pausa (plan vencido o pausado): se baja todo, no se sube. Nadie queda sin sus datos. ---
  const listed = (await adminCall("GET", "/households")).body.households as { id: string; members: number; licenseNote: string }[];
  const mine = listed.find((household) => household.id === householdId)!;
  assert.equal(mine.licenseNote, `prueba ${unique}`);
  assert.ok(!("encryptedName" in mine));
  assert.equal((await adminCall("POST", `/households/${householdId}/pause`)).status, 200);
  assert.equal((await anaAgain.call("GET", "/api/me")).body.households[0].planStatus, "paused");
  assert.equal((await pull(anaSigner)).status, 200);
  const paused = await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })]);
  assert.equal(paused.status, 402);
  assert.equal(paused.body.error, "plan-paused");
  assert.equal((await adminCall("POST", `/households/${householdId}/resume`)).status, 200);
  assert.equal((await push(anaSigner, [await op(anaSigner, "family", opened2.key, { changes: [] }, { keyVersion: 2 })])).status, 200);

  // --- Fotos (R2): bytes cifrados en el dispositivo; solo adultos administran, todos descargan ---
  const bytes = async (client: Client | null, method: string, path: string, body?: Uint8Array, origin: string | null = ORIGIN) => {
    const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
    if (origin) headers.Origin = origin;
    if (client) headers.Cookie = [...client.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    const response = await fetch(API + path, { method, headers, body: body ? new Uint8Array(body) : undefined });
    return { status: response.status, body: new Uint8Array(await response.arrayBuffer()) };
  };
  const photoPath = `/api/households/${householdId}/photos/${crypto.randomUUID()}`;
  const sealedPhoto = crypto.getRandomValues(new Uint8Array(4_000));
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/thumb`, sealedPhoto)).status, 200);
  const downloaded = await bytes(kid.client, "GET", `${photoPath}/thumb`);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(downloaded.body, sealedPhoto);
  // Quien ya no es de la casa, o sin sesión: nada. Una variante inventada tampoco.
  assert.equal((await bytes(flor.client, "GET", `${photoPath}/thumb`)).status, 404);
  assert.equal((await bytes(null, "GET", `${photoPath}/thumb`)).status, 401);
  assert.equal((await bytes(anaAgain, "GET", `${photoPath}/original`)).status, 404);
  // Un chico no administra fotos; sin Origin no se sube; más de 4 MB, tampoco.
  assert.equal((await bytes(kid.client, "PUT", `${photoPath}/thumb`, sealedPhoto)).status, 403);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, sealedPhoto, null)).status, 403);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, new Uint8Array(4 * 1024 * 1024 + 1))).status, 413);
  // En pausa no se sube.
  await adminCall("POST", `/households/${householdId}/pause`);
  assert.equal((await bytes(anaAgain, "PUT", `${photoPath}/full`, sealedPhoto)).status, 402);
  await adminCall("POST", `/households/${householdId}/resume`);
  // Borrar exige el mismo permiso de administración (Tomi no).
  assert.equal((await bytes(kid.client, "DELETE", photoPath)).status, 403);
  assert.equal((await bytes(anaAgain, "DELETE", photoPath)).status, 200);
  assert.equal((await bytes(anaAgain, "GET", `${photoPath}/thumb`)).status, 404);
});
