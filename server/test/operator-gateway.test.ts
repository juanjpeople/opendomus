import assert from "node:assert/strict";
import { test } from "node:test";
import gateway from "../src/operator-gateway";

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
