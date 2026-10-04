import assert from "node:assert/strict";
import { test } from "node:test";
import gateway, { createOperatorGateway } from "../src/operator-gateway";

test("el gateway no llama al binding sin host e identidad válidos", async () => {
  let forwarded = 0;
  const env = {
    OPERATOR_HOST: "operator.example.workers.dev",
    OPERATOR_ACCESS_ISSUER: "https://example.cloudflareaccess.com",
    OPERATOR_ACCESS_AUD: "operator-app",
    OPERATOR_EMAILS: "owner@example.com",
    OPENDOMUS: { fetch: async () => { forwarded++; return new Response("private"); } },
  } as Parameters<typeof gateway.fetch>[1];
  for (const url of [
    "https://public.example.workers.dev/api/admin/platform/overview",
    "https://operator.example.workers.dev/api/households",
    "https://operator.example.workers.dev/api/admin/platform/overview",
  ]) {
    for (const method of ["GET", "POST", "DELETE"]) {
      const response = await gateway.fetch(new Request(url, { method, headers: {
        "Cf-Access-Authenticated-User-Email": "owner@example.com",
        "Authorization": "Bearer untrusted",
      } }), env);
      assert.equal(response.status, 404);
    }
  }
  assert.equal(forwarded, 0);
});

test("panel privado: página y assets requieren identidad antes de leer el binding", async () => {
  let reads = 0;
  const env = { OPERATOR_HOST: "operator.example.workers.dev", OPENDOMUS: { fetch: async () => new Response("api") }, OPERATOR_ASSETS: { fetch: async () => { reads++; return new Response("private panel"); } } };
  for (const path of ["/", "/admin", "/panel.js"]) {
    const denied = await createOperatorGateway(async () => null).fetch(new Request(`https://${env.OPERATOR_HOST}${path}`), env);
    assert.equal(denied.status, 404);
  }
  assert.equal(reads, 0);
  const allowed = await createOperatorGateway(async () => "owner@example.com").fetch(new Request(`https://${env.OPERATOR_HOST}/admin`), env);
  assert.equal(await allowed.text(), "private panel");
  assert.equal(allowed.headers.get("Cache-Control"), "no-store");
  assert.equal(reads, 1);
});

test("panel privado: origen y cabecera obligatorios; el secreto solo llega al binding", async () => {
  const requests: Request[] = [];
  const token = "test-only-private-token-1234567890123456789";
  const env = { OPERATOR_HOST: "operator.example.workers.dev", OPERATOR_BROWSER_TOKEN: token, OPENDOMUS: { fetch: async (r: Request) => { requests.push(r); return Response.json({ ok: true }); } } };
  const gateway = createOperatorGateway(async () => "owner@example.com");
  const url = `https://${env.OPERATOR_HOST}/api/admin/platform/licenses`;
  const valid = { "X-OpenDomus-Operator": "browser", "Sec-Fetch-Site": "same-origin", Origin: `https://${env.OPERATOR_HOST}`, Cookie: "private-cookie" };
  for (const headers of [{}, { ...valid, Origin: "https://evil.example" }, { ...valid, "Sec-Fetch-Site": "cross-site" }, { ...valid, Origin: "null" }]) {
    assert.equal((await gateway.fetch(new Request(url, { method: "POST", headers }), env)).status, 404);
  }
  assert.equal(requests.length, 0);
  const response = await gateway.fetch(new Request(url, { method: "POST", headers: valid }), env);
  assert.equal(response.status, 200);
  assert.equal(requests[0].headers.get("Authorization"), `Bearer ${token}`);
  assert.equal(requests[0].headers.get("Cookie"), null);
  assert.equal(requests[0].headers.get("Origin"), null);
  assert.equal((await response.text()).includes(token), false);
  assert.equal((await gateway.fetch(new Request(url, { method: "POST", headers: valid }), { ...env, OPERATOR_BROWSER_TOKEN: undefined })).status, 404);
});
