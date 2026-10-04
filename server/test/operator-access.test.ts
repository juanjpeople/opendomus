import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { isLocalOperatorTest, verifyOperatorToken } from "../src/operator-access";

test("administración: firma, emisor, audiencia, vencimiento e identidad son obligatorios", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(publicKey), kid: "test", alg: "RS256" }] });
  const config = { APP_ORIGIN: "https://app.example", OPERATOR_ACCESS_ISSUER: "https://example.cloudflareaccess.com", OPERATOR_ACCESS_AUD: "admin-audience", OPERATOR_EMAILS: "owner@example.com" };
  const sign = (overrides: Record<string, unknown> = {}) => new SignJWT({
    email: "owner@example.com", sub: "verified-subject", iss: config.OPERATOR_ACCESS_ISSUER,
    aud: config.OPERATOR_ACCESS_AUD, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, ...overrides,
  }).setProtectedHeader({ alg: "RS256", kid: "test" }).sign(privateKey);
  const valid = await sign();
  assert.equal(await verifyOperatorToken(valid, config, keys), "owner@example.com");
  for (const overrides of [{ email: "intruder@example.com" }, { email: null }, { sub: "" }, { exp: 1 }, { exp: undefined }, { aud: "public-app" }, { iss: "https://other.cloudflareaccess.com" }]) {
    assert.equal(await verifyOperatorToken(await sign(overrides), config, keys), null);
  }
  assert.equal(await verifyOperatorToken(valid, { ...config, OPERATOR_EMAILS: "" }, keys), null);
  assert.equal(await verifyOperatorToken(valid, { ...config, OPERATOR_ACCESS_AUD: undefined }, keys), null);
  assert.equal(await verifyOperatorToken(`${valid.slice(0, valid.lastIndexOf(".") + 1)}invalid`, config, keys), null);
  assert.equal(await verifyOperatorToken("x".repeat(9000), config, keys), null);
});

test("el modo de prueba nunca habilita acceso con origen de producción o hosts remotos", () => {
  const local = new Request("http://127.0.0.1:8787/api/admin/licenses");
  assert.equal(isLocalOperatorTest(local, { APP_ORIGIN: "http://localhost:8787", OPERATOR_LOCAL_TEST: "1" }), true);
  assert.equal(isLocalOperatorTest(local, { APP_ORIGIN: "http://localhost:8787" }), false);
  assert.equal(isLocalOperatorTest(local, { APP_ORIGIN: "https://app.workers.dev", OPERATOR_LOCAL_TEST: "1" }), false);
  assert.equal(isLocalOperatorTest(new Request("https://app.workers.dev/api/admin/licenses"), { APP_ORIGIN: "http://localhost:8787", OPERATOR_LOCAL_TEST: "1" }), false);
});
