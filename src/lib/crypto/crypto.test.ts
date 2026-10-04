import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createIdentity,
  decodeRecoveryCode,
  derivePasswordKeys,
  encodeRecoveryCode,
  envelopeContext,
  importScopeKey,
  inviteSecrets,
  newScopeKey,
  open,
  openEnvelope,
  openText,
  recoverIdentity,
  seal,
  sealEnvelope,
  sign,
  unlockIdentity,
  verify,
} from "./index";

// Menos iteraciones en los tests (la derivación real es lenta a propósito).
const FAST = 1_000;

describe("contraseña", () => {
  test("misma contraseña y email → mismas claves; el email no distingue mayúsculas", async () => {
    const a = await derivePasswordKeys("Ana@Casa.com ", "una frase larga", FAST);
    const b = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    assert.equal(a.authKey, b.authKey);
    assert.equal(a.authKey.length, 43);
    const box = await seal(a.encKey, "secreto");
    assert.equal(await openText(b.encKey, box), "secreto");
  });

  test("otra contraseña u otro email → otras claves", async () => {
    const a = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    assert.notEqual(a.authKey, (await derivePasswordKeys("ana@casa.com", "otra frase", FAST)).authKey);
    assert.notEqual(a.authKey, (await derivePasswordKeys("flor@casa.com", "una frase larga", FAST)).authKey);
  });

  test("la clave que va al servidor no sirve para descifrar", async () => {
    const keys = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    const box = await seal(keys.encKey, "secreto");
    const fromAuth = await importScopeKey(Uint8Array.from(Buffer.from(keys.authKey, "base64url")));
    await assert.rejects(open(fromAuth, box));
  });
});

describe("cajas", () => {
  test("el contexto ata la caja a su lugar", async () => {
    const key = await importScopeKey(newScopeKey());
    const box = await seal(key, "Leche", "item|1");
    assert.equal(await openText(key, box, "item|1"), "Leche");
    await assert.rejects(open(key, box, "item|2"));
  });

  test("cualquier cambio en el contenido se detecta", async () => {
    const key = await importScopeKey(newScopeKey());
    const box = await seal(key, "Leche");
    const [iv, ct] = box.split(".");
    const tampered = `${iv}.${ct.slice(0, -2)}${ct.endsWith("A") ? "B" : "A"}${ct.slice(-1)}`;
    await assert.rejects(open(key, tampered));
  });
});

describe("identidad y recuperación", () => {
  test("se abre con la contraseña; con otra, no", async () => {
    const keys = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    const { upload } = await createIdentity(keys.encKey);
    const identity = await unlockIdentity(upload, keys.encKey);
    assert.equal(identity.encPublicKey, upload.encPublicKey);
    const wrong = await derivePasswordKeys("ana@casa.com", "otra frase", FAST);
    await assert.rejects(unlockIdentity(upload, wrong.encKey));
  });

  test("el kit de recuperación abre las claves y permite una contraseña nueva", async () => {
    const keys = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    const { upload, recoveryCode } = await createIdentity(keys.encKey);
    assert.match(recoveryCode, /^ODK1-([A-Z2-9]{4}-)+[A-Z2-9]{1,4}$/);
    const fresh = await derivePasswordKeys("ana@casa.com", "contraseña nueva", FAST);
    const { privateKeys } = await recoverIdentity(upload, recoveryCode.toLowerCase(), fresh.encKey);
    const identity = await unlockIdentity({ ...upload, privateKeys }, fresh.encKey);
    assert.equal(identity.signPublicKey, upload.signPublicKey);
  });

  test("el código del kit va y vuelve sin perder bits", () => {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    assert.deepEqual(decodeRecoveryCode(encodeRecoveryCode(raw)), raw);
    assert.throws(() => decodeRecoveryCode("ODK1-0000"));
  });

  test("firma y verificación", async () => {
    const keys = await derivePasswordKeys("ana@casa.com", "una frase larga", FAST);
    const { identity, upload } = await createIdentity(keys.encKey);
    const signature = await sign(identity, "inventory.adjust|leche|-1");
    assert.equal(await verify(upload.signPublicKey, "inventory.adjust|leche|-1", signature), true);
    assert.equal(await verify(upload.signPublicKey, "inventory.adjust|leche|-2", signature), false);
  });
});

describe("sobres de claves", () => {
  test("solo el destinatario abre su sobre, y solo en su contexto", async () => {
    const ana = await createIdentity((await derivePasswordKeys("ana@casa.com", "x", FAST)).encKey);
    const flor = await createIdentity((await derivePasswordKeys("flor@casa.com", "y", FAST)).encKey);
    const family = newScopeKey();
    const context = envelopeContext("casa-1", "family", 1, "flor");
    const envelope = await sealEnvelope(family, flor.upload.encPublicKey, context);

    const opened = await openEnvelope(envelope, flor.identity, context);
    assert.deepEqual(opened.raw, family);
    await assert.rejects(openEnvelope(envelope, ana.identity, context));
    await assert.rejects(openEnvelope(envelope, flor.identity, envelopeContext("casa-1", "adults", 1, "flor")));
  });
});

describe("invitaciones", () => {
  test("del mismo secreto salen el mismo token y la misma clave; el token no abre", async () => {
    const created = await inviteSecrets();
    const joined = await inviteSecrets(created.secret);
    assert.equal(joined.authToken, created.authToken);
    const box = await seal(created.wrapKey, "claves de la casa");
    assert.equal(await openText(joined.wrapKey, box), "claves de la casa");
    const fromToken = await importScopeKey(Uint8Array.from(Buffer.from(created.authToken, "base64url")));
    await assert.rejects(open(fromToken, box));
  });
});
