import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorHash, operatorSession, operatorTotp } from "../src/operator-auth";
import { operatorFixture, TEST_KEY, TEST_TOTP } from "./operator-fixture";

test("TOTP coincide con todos los vectores SHA-1 de RFC 6238", async () => {
  for (const [time, code] of [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"]] as const) assert.equal(await operatorTotp(TEST_TOTP, Math.floor(time / 30), 8), code);
});
test("operador: dos factores, cookies seguras, replay concurrente, revocación, expiración y rotación", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "Content-Type": "application/json", "X-OpenDomus-Operator": "browser" };
  const code = await operatorTotp(TEST_TOTP, Math.floor(Date.now() / 30_000));
  const login = (key = TEST_KEY, otp = code, extra = {}) => app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify({ key, code: otp }) }, env);
  assert.equal((await login("cd".repeat(32))).status, 401);
  const wrongCode = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
  assert.equal((await login(TEST_KEY, wrongCode)).status, 401);
  assert.equal((await login(TEST_KEY, code, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await login(TEST_KEY, code, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  const responses = await Promise.all([login(), login()]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
  const response = responses.find(r => r.status === 200)!;
  const setCookie = response.headers.get("set-cookie")!;
  assert.match(setCookie, /^__Host-od-operator=/); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const cookie = setCookie.split(";")[0];
  const request = new Request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers: { Cookie: cookie } });
  assert.equal(await operatorSession(request, env), "owner@example.com");
  assert.equal(await operatorSession(request, { ...env, OPERATOR_EMAIL: "other@example.com" }), null);
  assert.equal(await operatorSession(request, { ...env, OPERATOR_KEY_HASH: await operatorHash("ef".repeat(32)) }), null);
  assert.equal(await operatorSession(request, { ...env, OPERATOR_TOTP_SECRET: "A".repeat(32) }), null);
  const token = cookie.split("=")[1];
  assert.equal(database.prepare("SELECT token_hash FROM operator_sessions").get()?.token_hash, await operatorHash(token));
  database.exec("UPDATE operator_sessions SET expires_at = 1");
  assert.equal(await operatorSession(request, env), null);
  database.exec(`UPDATE operator_sessions SET expires_at = ${Date.now() + 60000}`);
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/logout`, { method: "POST", headers: { ...headers, Cookie: cookie } }, env)).status, 200);
  assert.equal(await operatorSession(request, env), null);
});
test("sin credenciales no hay acceso; token legado, cuenta doméstica y cabeceras Access no autorizan", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  app.get("/api/admin/platform/overview", c => c.json({ private: true }));
  for (const headers of [{}, { Authorization: `Bearer ${TEST_KEY}` }, { Cookie: "better-auth.session_token=household" }, { "Cf-Access-Jwt-Assertion": "forged", "Cf-Access-Authenticated-User-Email": env.OPERATOR_EMAIL! }] as Record<string, string>[]) {
    assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/platform/overview`, { headers }, env)).status, 404);
  }
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/session`, { headers: { "X-OpenDomus-Operator": "browser" } }, { ...env, OPERATOR_TOTP_SECRET: undefined })).status, 404);
  const request = new Request("https://other.example/api/admin/platform/overview");
  assert.equal(await operatorSession(request, env), null);
});
test("los intentos de ingreso se limitan en D1 y el cuerpo tiene un límite", async (t) => {
  const { app, env, database } = await operatorFixture(); t.after(() => database.close());
  const headers = { Origin: env.APP_ORIGIN, "X-OpenDomus-Operator": "browser", "Content-Type": "application/json" };
  for (let i = 0; i < 11; i++) {
    const response = await app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers, body: JSON.stringify({ key: "cd".repeat(32), code: "000000" }) }, env);
    assert.equal(response.status, i < 10 ? 401 : 429);
  }
  assert.equal((await app.request(`${env.APP_ORIGIN}/api/admin/auth/login`, { method: "POST", headers, body: JSON.stringify({ key: "x".repeat(3000) }) }, env)).status, 413);
});
