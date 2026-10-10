import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upload } from "./play-upload.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = { client_email: "play-upload@refugiar.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
const file = join(mkdtempSync(join(tmpdir(), "play-")), "app.aab");
writeFileSync(file, "aab");

/** Simula la API de Google: registra cada llamada y responde según la ruta. */
function fakeGoogle({ draftOnly = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: init.body });
    const json = (status, body) => new Response(JSON.stringify(body), { status });
    if (String(url).includes("oauth2")) return json(200, { access_token: "token" });
    if (String(url).endsWith("/edits")) return json(200, { id: "e1" });
    if (String(url).includes("/bundles")) return json(200, { versionCode: 7 });
    if (String(url).includes("/tracks/")) {
      const status = JSON.parse(init.body).releases[0].status;
      return draftOnly && status !== "draft" ? json(400, { error: { message: "Only releases with status draft may be created on draft app." } }) : json(200, {});
    }
    if (String(url).endsWith(":commit")) return json(200, {});
    return json(404, {});
  };
  return calls;
}

test("sube el paquete a la pista interna y confirma la edición", async () => {
  const calls = fakeGoogle();
  const result = await upload(account, file);
  assert.deepEqual(result, { versionCode: 7, track: "internal", status: "completed" });
  assert.deepEqual(calls.map((c) => c.url.replace(/^.*applications\/ar\.refugi\.app/, "")), [
    "https://oauth2.googleapis.com/token", "/edits", "/edits/e1/bundles?uploadType=media", "/edits/e1/tracks/internal", "/edits/e1:commit",
  ]);
  const [header, claims, signature] = new URLSearchParams(calls[0].body).get("assertion").split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, signature, "base64url"));
  assert.equal(JSON.parse(Buffer.from(claims, "base64url")).scope, "https://www.googleapis.com/auth/androidpublisher");
});

test("si la app sigue en borrador, deja la versión en borrador", async () => {
  fakeGoogle({ draftOnly: true });
  assert.equal((await upload(account, file)).status, "draft");
});
