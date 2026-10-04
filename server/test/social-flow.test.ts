import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { authOptions } from "../src/auth-options";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

for (const provider of ["github", "google"] as const) test(`OAuth ${provider}: vinculación explícita y rechazo de state reutilizado`, async (t) => {
  const database = new DatabaseSync(":memory:");
  t.after(() => database.close());
  const origin = "http://localhost:3199";
  const options = authOptions(database, {
    secret: "only-for-test-secret-at-least-thirty-two-bytes",
    baseURL: origin, trustedOrigins: [origin],
    [provider]: { clientId: "test-client", clientSecret: "test-secret" },
  });
  await (await getMigrations(options)).runMigrations();
  const auth = betterAuth({ ...options, logger: { disabled: true } });
  let email = "owner@example.test";
  let verified = true;
  let subject = 12345;
  let exchanges = 0;
  let nonce: string | null = null;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-google", alg: "RS256", use: "sig" };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === "https://github.com/login/oauth/access_token") {
      exchanges++;
      return Response.json({ access_token: "test-access-token", token_type: "bearer", scope: "read:user,user:email" });
    }
    if (url === "https://oauth2.googleapis.com/token") {
      exchanges++;
      const idToken = await new SignJWT({ email, email_verified: verified, name: "Owner", ...(nonce ? { nonce } : {}) })
        .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setSubject(String(subject)).setIssuer("https://accounts.google.com")
        .setAudience("test-client").setIssuedAt().setExpirationTime("5m").sign(privateKey);
      return Response.json({ access_token: "test-access-token", token_type: "bearer", expires_in: 300, id_token: idToken });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [jwk] });
    if (url === "https://api.github.com/user") return Response.json({ id: subject, login: "test-owner", name: "Owner", email });
    if (url === "https://api.github.com/user/emails") return Response.json([{ email, primary: true, verified }]);
    throw new Error("Unexpected external request in OAuth test");
  });
  type Jar = Map<string, string>;
  const clientIps = new WeakMap<Jar, string>();
  let nextClient = 1;
  const request = async (path: string, jar: Jar, body?: unknown) => {
    if (!clientIps.has(jar)) clientIps.set(jar, `203.0.113.${nextClient++}`);
    const response = await auth.handler(new Request(`${origin}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Origin: origin, "cf-connecting-ip": clientIps.get(jar)!, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
  const start = async (jar: Jar, link: boolean) => {
    const response = await request(link ? "/link-social" : "/sign-in/social", jar, {
      provider, callbackURL: `${origin}/cuenta`, errorCallbackURL: `${origin}/error`, disableRedirect: true,
    });
    assert.equal(response.status, 200);
    const { url } = await response.json() as { url: string };
    const state = new URL(url).searchParams.get("state");
    nonce = new URL(url).searchParams.get("nonce");
    assert(state);
    return `/callback/${provider}?code=test-code&state=${encodeURIComponent(state)}`;
  };
  const owner: Jar = new Map();
  const signup = await request("/sign-up/email", owner, { name: "Owner", email, password: "a".repeat(43) });
  assert.equal(signup.status, 200);
  const ownerId = (await signup.json() as { user: { id: string } }).user.id;

  const stranger: Jar = new Map();
  const implicit = await request(await start(stranger, false), stranger);
  assert.match(implicit.headers.get("location") ?? "", /error=/);
  assert.equal(database.prepare("select count(*) as n from account where providerId = ?").get(provider)?.n, 0);

  for (const profile of [{ email: "other@example.test", verified: true }, { email: "owner@example.test", verified: false }]) {
    email = profile.email;
    verified = profile.verified;
    const denied = await request(await start(owner, true), owner);
    assert.match(denied.headers.get("location") ?? "", /error=/);
    assert.equal(database.prepare("select count(*) as n from account where providerId = ?").get(provider)?.n, 0);
    assert.equal(database.prepare("select emailVerified from user where id = ?").get(ownerId)?.emailVerified, 0);
  }
  email = "owner@example.test";
  verified = true;

  const callback = await start(owner, true);
  const linked = await request(callback, owner);
  assert.equal(linked.headers.get("location"), `${origin}/cuenta`);
  const account = database.prepare("select userId, accessToken from account where providerId = ?").get(provider);
  assert.equal(account?.userId, ownerId);
  assert(account?.accessToken && account.accessToken !== "test-access-token", "OAuth tokens must be encrypted at rest");

  const beforeReplay = exchanges;
  const replay = await request(callback, owner);
  assert.match(replay.headers.get("location") ?? "", /error=/);
  assert.equal(exchanges, beforeReplay, "replayed state must not reach the provider");

  const returning: Jar = new Map();
  const firstAttempt = await request(await start(returning, false), returning);
  // Better Auth 1.7.7 actualiza la fila pero usa la copia anterior para este chequeo.
  // Documentamos el límite sin modificar emailVerified ni deshabilitar su validación.
  assert.match(firstAttempt.headers.get("location") ?? "", /email_not_verified/);
  assert.equal(await (await request("/get-session", returning)).json(), null);
  assert.equal(database.prepare("select emailVerified from user where id = ?").get(ownerId)?.emailVerified, 1);
  const signedIn = await request(await start(returning, false), returning);
  assert.equal(signedIn.headers.get("location"), `${origin}/cuenta`);
  const session = await request("/get-session", returning);
  assert.equal((await session.json() as { user: { id: string } }).user.id, ownerId);

  if (provider === "google") {
    const wrongAudience = await new SignJWT({ email, email_verified: true })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setSubject(String(subject))
      .setIssuer("https://accounts.google.com").setAudience("another-client").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    const invalid: Jar = new Map();
    const denied = await request("/sign-in/social", invalid, { provider, idToken: { token: wrongAudience } });
    assert.equal(denied.status, 401);
    assert.equal(await (await request("/get-session", invalid)).json(), null);
  }

  // Ni un usuario OAuth nuevo ni un email sin verificar pueden abrir sesión.
  email = "new@example.test";
  subject = 67890;
  verified = false;
  const unknown: Jar = new Map();
  const rejected = await request(await start(unknown, false), unknown);
  assert.match(rejected.headers.get("location") ?? "", /error=/);
  verified = true;
  const verifiedNewUser: Jar = new Map();
  const signupRejected = await request(await start(verifiedNewUser, false), verifiedNewUser);
  assert.match(signupRejected.headers.get("location") ?? "", /error=/);
  assert.equal(database.prepare("select count(*) as n from user").get()?.n, 1);
});
