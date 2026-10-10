import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { createOTP } from "@better-auth/utils/otp";
import { authOptions } from "../src/auth-options";

const origin = "http://localhost:3199";
const password = "a".repeat(43);
type Jar = Map<string, string>;

const b64u = (bytes: Uint8Array | Buffer) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

/** CBOR mínimo (mapas, enteros, bytes y texto): lo justo para armar una llave de acceso de prueba. */
function cbor(value: unknown): Buffer {
  const head = (major: number, length: number) =>
    length < 24 ? Buffer.from([(major << 5) | length]) : length < 256 ? Buffer.from([(major << 5) | 24, length]) : Buffer.from([(major << 5) | 25, length >> 8, length & 255]);
  if (typeof value === "number") return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === "string") return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (value instanceof Uint8Array) return Buffer.concat([head(2, value.length), value]);
  const entries = value instanceof Map ? [...value] : Object.entries(value as object);
  return Buffer.concat([head(5, entries.length), ...entries.flatMap(([key, entry]) => [cbor(key), cbor(entry)])]);
}

/** Un autenticador de software (ES256), como el que trae el teléfono o la computadora. */
function softwareAuthenticator() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  const rpIdHash = sha256("localhost");
  let counter = 0;
  const clientData = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id: b64u(credentialId),
    register(challenge: string) {
      const cose = new Map<number, number | Buffer>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, "base64url")], [-3, Buffer.from(jwk.y!, "base64url")]]);
      const authData = Buffer.concat([rpIdHash, Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), Buffer.from([0, credentialId.length]), credentialId, cbor(cose)]);
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64u(clientData("webauthn.create", challenge)), attestationObject: b64u(cbor({ fmt: "none", attStmt: {}, authData })), transports: ["internal"] },
      };
    },
    authenticate(challenge: string) {
      counter++;
      const authData = Buffer.concat([rpIdHash, Buffer.from([0x05]), Buffer.from([0, 0, 0, counter])]);
      const json = clientData("webauthn.get", challenge);
      const signature = sign("sha256", Buffer.concat([authData, sha256(json)]), privateKey);
      return {
        id: b64u(credentialId), rawId: b64u(credentialId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64u(json), authenticatorData: b64u(authData), signature: b64u(signature) },
      };
    },
  };
}

async function setup(t: { after(fn: () => void): void; mock: { method: typeof import("node:test").mock.method } }) {
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  const options = authOptions(database, {
    secret: "only-for-test-secret-at-least-thirty-two-bytes",
    baseURL: origin, trustedOrigins: [origin],
    github: { clientId: "test-client", clientSecret: "test-secret" },
  });
  await (await getMigrations(options)).runMigrations();
  const auth = betterAuth({ ...options, logger: { disabled: true } });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://github.com/login/oauth/access_token") return Response.json({ access_token: "test-access-token", token_type: "bearer", scope: "read:user,user:email" });
    if (url === "https://api.github.com/user") return Response.json({ id: 4242, login: "owner", name: "Owner", email: "owner@example.test" });
    if (url === "https://api.github.com/user/emails") return Response.json([{ email: "owner@example.test", primary: true, verified: true }]);
    throw new Error(`Unexpected external request: ${url}`);
  });
  // Cada pedido con otra IP: acá se prueba el flujo, no el límite de intentos.
  let ip = 1;
  const request = async (path: string, jar: Jar, body?: unknown) => {
    const response = await auth.handler(new Request(`${origin}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Origin: origin, "cf-connecting-ip": `198.51.100.${ip++ % 250}`, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      if (/Max-Age=0/i.test(cookie)) jar.delete(pair.slice(0, index));
      else jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
  const sessionUser = async (jar: Jar) => ((await (await request("/get-session", jar)).json()) as { user: { id: string } } | null)?.user.id ?? null;
  return { database, request, sessionUser };
}

test("dos pasos: código, respaldo, llave de acceso solo como segundo paso y Google/GitHub", async (t) => {
  const { database, request, sessionUser } = await setup(t);
  const owner: Jar = new Map();
  const signup = await request("/sign-up/email", owner, { name: "Owner", email: "owner@example.test", password });
  const ownerId = ((await signup.json()) as { user: { id: string } }).user.id;

  // Encender: pide la contraseña; queda apagado hasta confirmar un código.
  assert.equal((await request("/two-factor/enable", owner, { password: "b".repeat(43) })).status, 400);
  const enabled = (await (await request("/two-factor/enable", owner, { password })).json()) as { totpURI: string; backupCodes: string[] };
  assert.equal(enabled.backupCodes.length, 10);
  // El URI lleva el secreto en base32; createOTP quiere el secreto tal cual.
  const base32 = new URL(enabled.totpURI).searchParams.get("secret")!;
  const bits = [...base32.replace(/=+$/, "")].map((char) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0")).join("");
  const secret = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2))).toString();
  const code = () => createOTP(secret).totp();
  assert.equal(database.prepare(`select twoFactorEnabled as on_ from "user" where id = ?`).get(ownerId)?.on_, 0);
  assert.equal((await request("/two-factor/verify-totp", owner, { code: await code() })).status, 200);
  assert.equal(database.prepare(`select twoFactorEnabled as on_ from "user" where id = ?`).get(ownerId)?.on_, 1);
  assert.equal(await sessionUser(owner), ownerId, "la sesión que encendió los dos pasos sigue abierta");
  assert.notEqual(database.prepare(`select secret from "twoFactor"`).get()?.secret, secret, "el secreto se guarda cifrado");

  // La llave de acceso se registra con sesión.
  const key = softwareAuthenticator();
  const registerOptions = (await (await request("/passkey/generate-register-options", owner)).json()) as { challenge: string; authenticatorSelection: { residentKey: string } };
  assert.equal(registerOptions.authenticatorSelection.residentKey, "required");
  assert.equal((await request("/passkey/verify-registration", owner, { response: key.register(registerOptions.challenge), name: "Teléfono" })).status, 200);

  // Con email y contraseña ya no alcanza: no hay sesión hasta el segundo paso.
  const device: Jar = new Map();
  const signin = await request("/sign-in/email", device, { email: "owner@example.test", password });
  assert.deepEqual(await signin.json(), { twoFactorRedirect: true, twoFactorMethods: ["totp"] });
  assert.equal(await sessionUser(device), null);
  assert.equal((await request("/two-factor/verify-totp", device, { code: "000000" })).status, 401);
  assert.equal((await request("/two-factor/verify-totp", device, { code: await code() })).status, 200);
  assert.equal(await sessionUser(device), ownerId);

  // Código de respaldo: sirve una sola vez.
  const backup = enabled.backupCodes[0];
  for (const expected of [200, 401]) {
    const jar: Jar = new Map();
    await request("/sign-in/email", jar, { email: "owner@example.test", password });
    assert.equal((await request("/two-factor/verify-backup-code", jar, { code: backup })).status, expected);
  }

  // La llave sola (sin contraseña) no abre sesión.
  const stranger: Jar = new Map();
  const loneOptions = (await (await request("/passkey/generate-authenticate-options", stranger)).json()) as { challenge: string };
  assert.equal((await request("/passkey/verify-authentication", stranger, { response: key.authenticate(loneOptions.challenge) })).status, 401);
  assert.equal(await sessionUser(stranger), null);

  // Contraseña + llave: sesión. El desafío se consume (no se puede reusar).
  const phone: Jar = new Map();
  await request("/sign-in/email", phone, { email: "owner@example.test", password });
  const challengeCookie = [...phone].find(([name]) => name.endsWith("two_factor"))!;
  const authOptions = (await (await request("/passkey/generate-authenticate-options", phone)).json()) as { challenge: string };
  assert.equal((await request("/passkey/verify-authentication", phone, { response: key.authenticate(authOptions.challenge) })).status, 200);
  assert.equal(await sessionUser(phone), ownerId);
  const replay: Jar = new Map([challengeCookie]);
  const replayOptions = (await (await request("/passkey/generate-authenticate-options", replay)).json()) as { challenge: string };
  assert.equal((await request("/passkey/verify-authentication", replay, { response: key.authenticate(replayOptions.challenge) })).status, 401);

  // GitHub tampoco saltea el segundo paso.
  const linkUrl = new URL(((await (await request("/link-social", owner, { provider: "github", callbackURL: `${origin}/ajustes`, disableRedirect: true })).json()) as { url: string }).url);
  await request(`/callback/github?code=test&state=${encodeURIComponent(linkUrl.searchParams.get("state")!)}`, owner);
  const social: Jar = new Map();
  const socialSignIn = async () => {
    const start = (await (await request("/sign-in/social", social, { provider: "github", callbackURL: `${origin}/cuenta?modo=entrar&social=1`, disableRedirect: true })).json()) as { url: string };
    return request(`/callback/github?code=test&state=${encodeURIComponent(new URL(start.url).searchParams.get("state")!)}`, social);
  };
  // Better Auth 1.7.7 marca el email verificado en el primer intento y lo rechaza igual (ver social-flow.test.ts).
  assert.match((await socialSignIn()).headers.get("location") ?? "", /email_not_verified/);
  const callback = await socialSignIn();
  assert.equal(callback.headers.get("location"), `${origin}/cuenta?modo=entrar&social=1&dos-pasos=1`);
  assert.equal(await sessionUser(social), null);
  assert.equal((await request("/two-factor/verify-totp", social, { code: await code() })).status, 200);
  assert.equal(await sessionUser(social), ownerId);

  // Apagar pide la contraseña y borra las llaves (solo eran segundo paso).
  assert.equal((await request("/two-factor/disable", owner, { password: "b".repeat(43) })).status, 400);
  assert.equal((await request("/two-factor/disable", owner, { password })).status, 200);
  assert.equal(database.prepare(`select count(*) as n from passkey`).get()?.n, 0);
  const plain: Jar = new Map();
  await request("/sign-in/email", plain, { email: "owner@example.test", password });
  assert.equal(await sessionUser(plain), ownerId);
});
